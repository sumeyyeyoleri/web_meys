import {
  UPLOAD_ALLOWED_EXTENSIONS,
  UPLOAD_ALLOWED_MIME_TYPES,
  UPLOAD_MAX_FILE_SIZE_BYTES,
  UPLOAD_MAX_FILES,
} from './constants';

export interface UploadCandidate {
  name: string;
  size: number;
  type: string;
}

/** Returns an i18n error key for a single reference image, or `null` if it is acceptable. */
export function validateUploadCandidate(file: UploadCandidate): string | null {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = UPLOAD_ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  if (!(UPLOAD_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type) || !hasAllowedExtension) {
    return 'validation.fileType';
  }
  if (file.size > UPLOAD_MAX_FILE_SIZE_BYTES) return 'validation.fileTooLarge';
  if (file.size === 0) return 'validation.fileEmpty';
  return null;
}

export function exceedsUploadCount(count: number): boolean {
  return count > UPLOAD_MAX_FILES;
}
