import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { DevConfigService } from '../config/dev-config.service';
import {
  DischargeSummaryVersion,
  DischargeSummaryLanguage,
  DischargeSummaryContent,
} from './discharge-summary.types';

@Injectable()
export class GcsService {
  private readonly logger = new Logger(GcsService.name);
  private storage: Storage | null = null;
  private readonly buckets = {
    raw: 'discharge-summaries-raw',
    simplified: 'discharge-summaries-simplified',
    translated: 'discharge-summaries-translated',
  };

  constructor(private configService: DevConfigService) {}

  /**
   * Initialize storage client lazily (only when first needed)
   */
  private getStorage(): Storage {
    if (!this.storage) {
      const config = this.configService.get();
      const serviceAccountPath = config.service_account_path;

      this.storage = new Storage({
        keyFilename: serviceAccountPath,
      });

      this.logger.log('GCS Service initialized');
    }
    return this.storage;
  }

  /**
   * Get bucket name based on version
   */
  private getBucketName(version: DischargeSummaryVersion): string {
    switch (version) {
      case DischargeSummaryVersion.RAW:
        return this.buckets.raw;
      case DischargeSummaryVersion.SIMPLIFIED:
        return this.buckets.simplified;
      case DischargeSummaryVersion.TRANSLATED:
        return this.buckets.translated;
      default:
        throw new Error(`Unknown version: ${version}`);
    }
  }

  /**
   * List all files in a bucket
   */
  async listFiles(version: DischargeSummaryVersion): Promise<string[]> {
    const bucketName = this.getBucketName(version);
    const [files] = await this.getStorage().bucket(bucketName).getFiles();

    return files
      .filter((file) => file.name.endsWith('.md'))
      .map((file) => file.name);
  }

  /**
   * Check if file exists
   */
  async fileExists(
    version: DischargeSummaryVersion,
    fileName: string,
  ): Promise<boolean> {
    const bucketName = this.getBucketName(version);
    const file = this.getStorage().bucket(bucketName).file(fileName);
    const [exists] = await file.exists();
    return exists;
  }

  /**
   * Get file content
   */
  async getFileContent(
    version: DischargeSummaryVersion,
    fileName: string,
    language?: DischargeSummaryLanguage,
  ): Promise<DischargeSummaryContent> {
    const bucketName = this.getBucketName(version);

    // For translated versions, append language code
    let fullFileName = fileName;
    if (version === DischargeSummaryVersion.TRANSLATED && language) {
      // Remove .md extension and add language code
      const baseName = fileName.replace(/\.md$/, '');
      fullFileName = `${baseName}-${language}.md`;
    }

    const file = this.getStorage().bucket(bucketName).file(fullFileName);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new NotFoundException(
        `File not found: ${fullFileName} in bucket ${bucketName}`,
      );
    }

    // Get file metadata
    const [metadata] = await file.getMetadata();

    // Download file content
    const [content] = await file.download();

    return {
      content: content.toString('utf-8'),
      version,
      language: language || DischargeSummaryLanguage.EN,
      fileSize: parseInt(metadata.size as string, 10),
      lastModified: new Date(metadata.updated as string),
    };
  }

  /**
   * Get file metadata without downloading content
   */
  async getFileMetadata(
    version: DischargeSummaryVersion,
    fileName: string,
  ): Promise<{
    size: number;
    contentType: string;
    created: Date;
    updated: Date;
  }> {
    const bucketName = this.getBucketName(version);
    const file = this.getStorage().bucket(bucketName).file(fileName);

    const [exists] = await file.exists();
    if (!exists) {
      throw new NotFoundException(
        `File not found: ${fileName} in bucket ${bucketName}`,
      );
    }

    const [metadata] = await file.getMetadata();

    return {
      size: parseInt(metadata.size as string, 10),
      contentType: metadata.contentType || 'text/markdown',
      created: new Date(metadata.timeCreated as string),
      updated: new Date(metadata.updated as string),
    };
  }

  /**
   * Parse patient information from filename
   * Expects format: "Patient Name - Description.md" or similar
   */
  parseFilename(fileName: string): {
    patientName?: string;
    description?: string;
  } {
    // Remove file extension
    const baseName = fileName.replace(/\.md$/, '');

    // Try to parse patient name and description
    const parts = baseName.split(' - ');

    if (parts.length >= 2) {
      return {
        patientName: parts[0].trim(),
        description: parts.slice(1).join(' - ').trim(),
      };
    }

    return {
      description: baseName,
    };
  }

  /**
   * Find related files (raw, simplified, translated versions)
   */
  async findRelatedFiles(baseFileName: string): Promise<{
    raw?: string;
    simplified?: string;
    translated?: { [key: string]: string };
  }> {
    const result: {
      raw?: string;
      simplified?: string;
      translated?: { [key: string]: string };
    } = {};

    // Check raw bucket
    const rawExists = await this.fileExists(
      DischargeSummaryVersion.RAW,
      baseFileName,
    );
    if (rawExists) {
      result.raw = baseFileName;
    }

    // Check simplified bucket
    // Simplified files typically have "-simplified" suffix
    const simplifiedFileName = baseFileName.replace(
      /\.md$/,
      '-simplified.md',
    );
    const simplifiedExists = await this.fileExists(
      DischargeSummaryVersion.SIMPLIFIED,
      simplifiedFileName,
    );
    if (simplifiedExists) {
      result.simplified = simplifiedFileName;
    }

    // Check translated bucket for different languages
    result.translated = {};
    const languages = Object.values(DischargeSummaryLanguage);

    for (const lang of languages) {
      const translatedFileName = baseFileName.replace(
        /\.md$/,
        `-simplified-${lang}.md`,
      );
      try {
        const exists = await this.fileExists(
          DischargeSummaryVersion.TRANSLATED,
          translatedFileName,
        );
        if (exists) {
          result.translated[lang] = translatedFileName;
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    return result;
  }

  /**
   * Get bucket statistics
   */
  async getBucketStats(): Promise<{
    raw: number;
    simplified: number;
    translated: number;
  }> {
    const storage = this.getStorage();
    const [rawFiles] = await storage
      .bucket(this.buckets.raw)
      .getFiles();
    const [simplifiedFiles] = await storage
      .bucket(this.buckets.simplified)
      .getFiles();
    const [translatedFiles] = await storage
      .bucket(this.buckets.translated)
      .getFiles();

    return {
      raw: rawFiles.filter((f) => f.name.endsWith('.md')).length,
      simplified: simplifiedFiles.filter((f) => f.name.endsWith('.md')).length,
      translated: translatedFiles.filter((f) => f.name.endsWith('.md')).length,
    };
  }

  /**
   * Delete a file from GCS
   */
  async deleteFile(version: DischargeSummaryVersion, fileName: string): Promise<void> {
    const storage = this.getStorage();
    const bucketName = this.getBucketName(version);
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.delete();
    this.logger.log(`Deleted file ${fileName} from bucket ${bucketName}`);
  }
}
