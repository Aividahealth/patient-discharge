import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
  Logger,
  Request,
  UseGuards,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserService } from './user.service';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard, TenantGuard } from './guards';
import type { CreateUserRequest, UpdateUserRequest, UserResponse } from './types/user.types';

@Controller('api/users')
@UseGuards(RolesGuard, TenantGuard)
@Roles('tenant_admin', 'system_admin')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly userService: UserService) {}

  /**
   * GET /api/users
   * List all users for the authenticated tenant
   * Requires: tenant_admin or system_admin role
   * Protected by: RolesGuard, TenantGuard
   */
  @Get()
  async listUsers(@Request() req): Promise<UserResponse[]> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Listing users for tenant: ${tenantId}`);

      const users = await this.userService.findByTenant(tenantId);

      // Map to response format (exclude passwordHash and sensitive fields)
      return users.map(user => ({
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedPatientId: user.linkedPatientId,
        isActive: user.isActive,
        isLocked: user.isLocked,
        failedLoginAttempts: user.failedLoginAttempts,
        lastSuccessfulLoginAt: user.lastSuccessfulLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.createdBy,
        lastUpdatedBy: user.lastUpdatedBy,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error listing users: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to list users', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/users/:id
   * Get a specific user by ID
   * Requires: tenant_admin or system_admin role
   * Protected by: RolesGuard, TenantGuard
   */
  @Get(':id')
  async getUser(@Param('id') id: string, @Request() req): Promise<UserResponse> {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      const user = await this.userService.findById(id);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      // Verify user belongs to the same tenant (TenantGuard already checked this)
      if (user.tenantId !== tenantId) {
        throw new HttpException('Unauthorized access to user', HttpStatus.FORBIDDEN);
      }

      return {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedPatientId: user.linkedPatientId,
        isActive: user.isActive,
        isLocked: user.isLocked,
        failedLoginAttempts: user.failedLoginAttempts,
        lastSuccessfulLoginAt: user.lastSuccessfulLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.createdBy,
        lastUpdatedBy: user.lastUpdatedBy,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error getting user: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to get user', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/users
   * Create a new user for the authenticated tenant
   * Requires: tenant_admin or system_admin role
   * Protected by: RolesGuard, TenantGuard
   */
  @Post()
  async createUser(
    @Body() request: CreateUserRequest,
    @Request() req,
  ): Promise<UserResponse> {
    try {
      const tenantId = req.user?.tenantId;
      const creatorId = req.user?.userId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      // Validate request
      if (!request.username || !request.password || !request.name || !request.role) {
        throw new HttpException(
          'Missing required fields: username, password, name, and role are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Check if username already exists in this tenant
      const existingUser = await this.userService.findByUsername(tenantId, request.username);
      if (existingUser) {
        throw new HttpException(
          'Username already exists in this tenant',
          HttpStatus.CONFLICT,
        );
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(request.password, 10);

      // Create user with new account status fields
      const user = await this.userService.create({
        tenantId,
        username: request.username,
        passwordHash,
        name: request.name,
        email: request.email,
        role: request.role,
        linkedPatientId: request.linkedPatientId,
        isActive: true, // New users are active by default
        isLocked: false,
        failedLoginAttempts: 0,
        createdBy: creatorId,
      });

      this.logger.log(`Created user: ${user.id} (${user.username}) for tenant: ${tenantId} by admin: ${creatorId}`);

      return {
        id: user.id,
        tenantId: user.tenantId,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        linkedPatientId: user.linkedPatientId,
        isActive: user.isActive,
        isLocked: user.isLocked,
        failedLoginAttempts: user.failedLoginAttempts,
        lastSuccessfulLoginAt: user.lastSuccessfulLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        createdBy: user.createdBy,
        lastUpdatedBy: user.lastUpdatedBy,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error creating user: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to create user', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/users/:id
   * Update an existing user
   * Requires: tenant_admin or system_admin role
   * Protected by: RolesGuard, TenantGuard
   */
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() request: UpdateUserRequest,
    @Request() req,
  ): Promise<UserResponse> {
    try {
      const tenantId = req.user?.tenantId;
      const updaterId = req.user?.userId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      // Check if user exists and belongs to this tenant
      const existingUser = await this.userService.findById(id);
      if (!existingUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (existingUser.tenantId !== tenantId) {
        throw new HttpException('Unauthorized access to user', HttpStatus.FORBIDDEN);
      }

      // Prepare update data
      const updateData: any = {
        name: request.name,
        email: request.email,
        role: request.role,
        linkedPatientId: request.linkedPatientId,
        lastUpdatedBy: updaterId,
      };

      // If password is being updated, hash it
      if (request.password) {
        updateData.passwordHash = await bcrypt.hash(request.password, 10);
      }

      // Update user
      const updatedUser = await this.userService.update(id, updateData);

      this.logger.log(`Updated user: ${id} for tenant: ${tenantId} by admin: ${updaterId}`);

      return {
        id: updatedUser.id,
        tenantId: updatedUser.tenantId,
        username: updatedUser.username,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        linkedPatientId: updatedUser.linkedPatientId,
        isActive: updatedUser.isActive,
        isLocked: updatedUser.isLocked,
        failedLoginAttempts: updatedUser.failedLoginAttempts,
        lastSuccessfulLoginAt: updatedUser.lastSuccessfulLoginAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        createdBy: updatedUser.createdBy,
        lastUpdatedBy: updatedUser.lastUpdatedBy,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error updating user: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to update user', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/users/:id
   * Delete a user
   * Requires: tenant_admin or system_admin role
   * Protected by: RolesGuard, TenantGuard
   */
  @Delete(':id')
  async deleteUser(@Param('id') id: string, @Request() req): Promise<{ success: boolean; message: string }> {
    try {
      const tenantId = req.user?.tenantId;
      const deleterId = req.user?.userId;

      if (!tenantId) {
        throw new HttpException('Tenant ID not found in request', HttpStatus.BAD_REQUEST);
      }

      // Check if user exists and belongs to this tenant
      const existingUser = await this.userService.findById(id);
      if (!existingUser) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (existingUser.tenantId !== tenantId) {
        throw new HttpException('Unauthorized access to user', HttpStatus.FORBIDDEN);
      }

      // Prevent self-deletion
      if (id === deleterId) {
        throw new HttpException('Cannot delete your own account', HttpStatus.BAD_REQUEST);
      }

      // Delete user
      await this.userService.delete(id);

      this.logger.log(`Deleted user: ${id} (${existingUser.username}) from tenant: ${tenantId} by admin: ${deleterId}`);

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error deleting user: ${error.message}`);
      throw new HttpException(
        { message: 'Failed to delete user', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
