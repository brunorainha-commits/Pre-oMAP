// src/repositories/UploadRepository.ts
import { BaseRepository } from './BaseRepository';
import type { Upload } from './types';

export class UploadRepository extends BaseRepository<Upload> {
  constructor() {
    super('precomap_uploads');
  }
}

export const uploadRepository = new UploadRepository();
