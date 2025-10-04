import { Controller, Get, Param, Post, Body, Put, Delete, Query } from '@nestjs/common';
import { GoogleService } from './google.service';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Get('token')
  getToken() {
    return this.googleService.getAccessToken();
  }

  @Post('impersonate/:email')
  impersonate(@Param('email') email: string, @Body() body: any) {
    return this.googleService.impersonate(email, body?.scopes);
  }

  // FHIR CRUD proxied under Google
  @Post('fhir/:resourceType')
  fhirCreate(@Param('resourceType') resourceType: string, @Body() body: unknown) {
    return this.googleService.fhirCreate(resourceType, body);
  }

  @Get('fhir/:resourceType/:id')
  fhirRead(@Param('resourceType') resourceType: string, @Param('id') id: string) {
    return this.googleService.fhirRead(resourceType, id);
  }

  @Put('fhir/:resourceType/:id')
  fhirUpdate(
    @Param('resourceType') resourceType: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.googleService.fhirUpdate(resourceType, id, body);
  }

  @Delete('fhir/:resourceType/:id')
  fhirDelete(@Param('resourceType') resourceType: string, @Param('id') id: string) {
    return this.googleService.fhirDelete(resourceType, id);
  }

  @Get('fhir/:resourceType')
  fhirSearch(@Param('resourceType') resourceType: string, @Query() query: any) {
    return this.googleService.fhirSearch(resourceType, query);
  }
}


