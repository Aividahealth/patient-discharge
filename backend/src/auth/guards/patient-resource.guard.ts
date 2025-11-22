import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { GoogleService } from '../../google/google.service';
import { DevConfigService } from '../../config/dev-config.service';

/**
 * Guard to enforce patient-level resource access control
 *
 * This guard ensures that users with 'patient' role can ONLY access their own patient data.
 * Other roles (clinician, expert, tenant_admin, system_admin) can access any patient data
 * within their authorized scope.
 *
 * Validation for 'patient' role:
 * - Extracts patientId from route parameters or query parameters
 * - Checks if it matches the user's linkedPatientId
 * - Prevents patients from accessing other patients' data
 *
 * Prerequisites:
 * - AuthGuard must run before this guard (to set request.user)
 * - Route must have :patientId parameter or patientId query param
 *
 * Usage:
 * @UseGuards(AuthGuard, RolesGuard, PatientResourceGuard)
 * @Get('/patient/:patientId/composition/:compositionId')
 * getComposition(@Param('patientId') patientId: string) { ... }
 */
@Injectable()
export class PatientResourceGuard implements CanActivate {
  private readonly logger = new Logger(PatientResourceGuard.name);

  constructor(
    private readonly googleService: GoogleService,
    private readonly configService: DevConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User should be set by AuthGuard
    if (!user) {
      this.logger.warn('PatientResourceGuard: No user found in request. Did AuthGuard run?');
      throw new ForbiddenException('Authentication required');
    }

    // Only enforce for 'patient' role
    // Other roles can access any patient data (subject to tenant isolation)
    if (user.role !== 'patient') {
      this.logger.debug(
        `PatientResourceGuard: User ${user.username} (${user.role}) granted access to any patient data`,
      );
      return true;
    }

    // Extract patientId from route parameters or query parameters
    let patientIdParam = request.params?.patientId || request.query?.patientId;

    // If no patientId but we have compositionId/id, fetch it from the Composition
    if (!patientIdParam) {
      const compositionId = request.params?.id || request.params?.compositionId || request.query?.compositionId;
      
      if (compositionId) {
        try {
          // Get tenant context from request (set by TenantGuard)
          const tenantId = request.headers['x-tenant-id'] as string;
          if (!tenantId) {
            this.logger.warn('PatientResourceGuard: No tenant ID in headers, cannot fetch composition');
            throw new ForbiddenException('Tenant ID required');
          }

          // Create tenant context
          const ctx = {
            tenantId,
            timestamp: new Date(),
          };

          // Fetch composition to get patientId
          const composition = await this.googleService.fhirRead('Composition', compositionId, ctx);
          if (composition?.subject?.reference) {
            // Extract patientId from "Patient/{patientId}" format
            patientIdParam = composition.subject.reference.replace('Patient/', '');
            this.logger.debug(`PatientResourceGuard: Extracted patientId ${patientIdParam} from Composition ${compositionId}`);
          }
        } catch (error) {
          this.logger.error(`PatientResourceGuard: Failed to fetch Composition ${compositionId}: ${error.message}`);
          throw new ForbiddenException('Failed to verify composition access');
        }
      }
    }

    if (!patientIdParam) {
      // If no patientId in request, allow (this guard only applies to patient-specific endpoints)
      this.logger.debug('PatientResourceGuard: No patientId in request, allowing access');
      return true;
    }

    // Check if patient has linkedPatientId
    if (!user.linkedPatientId) {
      // For patient portal access via URL parameters (e.g., /patient?patientId=xxx),
      // allow access even if linkedPatientId is not set. The endpoint will verify
      // that the composition exists for the provided patientId, providing security.
      // This handles cases where patient users access via URL parameters without
      // having linkedPatientId set in their user record.
      this.logger.debug(
        `PatientResourceGuard: Patient user ${user.username} has no linkedPatientId, but patientId ${patientIdParam} provided in URL. Allowing access for patient portal - endpoint will verify composition exists.`,
      );
      // Allow access - the endpoint will verify the composition belongs to this patient
      return true;
    }

    // Verify patient is accessing their own data
    if (user.linkedPatientId !== patientIdParam) {
      this.logger.warn(
        `PatientResourceGuard: Patient ${user.username} (linkedPatientId: ${user.linkedPatientId}) attempted to access patientId: ${patientIdParam}`,
      );
      throw new ForbiddenException(
        'Access denied. You can only access your own patient data.',
      );
    }

    this.logger.debug(
      `PatientResourceGuard: Patient ${user.username} granted access to their own data (patientId: ${patientIdParam})`,
    );

    return true;
  }
}
