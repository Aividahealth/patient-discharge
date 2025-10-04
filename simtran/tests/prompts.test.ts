import { createSimplificationPrompt, SIMPLIFICATION_SYSTEM_PROMPT } from '../src/utils/prompts';

describe('Prompts', () => {
  describe('SIMPLIFICATION_SYSTEM_PROMPT', () => {
    it('should contain key instructions', () => {
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('medical communication specialist');
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('high school reading level');
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('9th-10th grade');
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('preserving all critical medical information');
    });

    it('should include examples', () => {
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('Example');
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('COPD');
      expect(SIMPLIFICATION_SYSTEM_PROMPT).toContain('heart attack');
    });
  });

  describe('createSimplificationPrompt', () => {
    it('should create prompt with content and filename', () => {
      const content = 'Test discharge summary content';
      const fileName = 'test-summary.md';

      const prompt = createSimplificationPrompt(content, fileName);

      expect(prompt).toContain(fileName);
      expect(prompt).toContain(content);
      expect(prompt).toContain('simplify');
      expect(prompt).toContain('medical terms');
    });

    it('should include key instructions in user prompt', () => {
      const content = 'Sample content';
      const fileName = 'sample.md';

      const prompt = createSimplificationPrompt(content, fileName);

      expect(prompt).toContain('Explain all medical terms');
      expect(prompt).toContain('Keep all dates');
      expect(prompt).toContain('medications');
      expect(prompt).toContain('follow-up instructions');
      expect(prompt).toContain('markdown structure');
    });
  });
});
