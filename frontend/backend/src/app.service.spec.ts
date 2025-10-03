import { AppService } from './app.service';

describe('AppService', () => {
	let appService: AppService;

	beforeEach(() => {
		appService = new AppService();
	});

	test('should return expected value', () => {
		expect(appService.someMethod()).toBe('expected value');
	});
});