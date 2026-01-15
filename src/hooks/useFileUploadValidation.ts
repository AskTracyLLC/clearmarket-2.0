import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}

const DEFAULT_ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
];

const DEFAULT_ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Shared file upload validation hook.
 * Enforces max file size (default 5MB for images, 10MB for docs),
 * allowed MIME types, and max file count.
 */
export function useFileUploadValidation(options: FileValidationOptions = {}) {
  const { toast } = useToast();

  const {
    maxSizeMB = 5,
    allowedTypes = DEFAULT_ALLOWED_IMAGE_TYPES,
    maxFiles = 5,
  } = options;

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): ValidationResult => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        const typeList = allowedTypes
          .map((t) => t.split("/")[1]?.toUpperCase())
          .filter(Boolean)
          .join(", ");
        return {
          valid: false,
          error: `Invalid file type. Allowed: ${typeList}`,
        };
      }

      // Check file size
      if (file.size > maxSizeBytes) {
        return {
          valid: false,
          error: `File too large. Maximum size is ${maxSizeMB} MB.`,
        };
      }

      return { valid: true };
    },
    [allowedTypes, maxSizeBytes, maxSizeMB]
  );

  const validateFiles = useCallback(
    (files: FileList | File[], currentCount = 0): { validFiles: File[]; errors: string[] } => {
      const validFiles: File[] = [];
      const errors: string[] = [];

      const fileArray = Array.from(files);
      const remainingSlots = maxFiles - currentCount;

      if (fileArray.length > remainingSlots) {
        errors.push(`You can only add ${remainingSlots} more file(s). Maximum is ${maxFiles}.`);
        return { validFiles: [], errors };
      }

      for (const file of fileArray) {
        const result = validateFile(file);
        if (result.valid) {
          validFiles.push(file);
        } else if (result.error) {
          errors.push(`${file.name}: ${result.error}`);
        }
      }

      return { validFiles, errors };
    },
    [validateFile, maxFiles]
  );

  const validateAndToast = useCallback(
    (files: FileList | File[], currentCount = 0): File[] => {
      const { validFiles, errors } = validateFiles(files, currentCount);

      if (errors.length > 0) {
        toast({
          title: "Upload Error",
          description: errors[0], // Show first error
          variant: "destructive",
        });
      }

      return validFiles;
    },
    [validateFiles, toast]
  );

  return {
    validateFile,
    validateFiles,
    validateAndToast,
    maxSizeMB,
    maxFiles,
    allowedTypes,
  };
}

// Preset configurations
export const IMAGE_UPLOAD_CONFIG: FileValidationOptions = {
  maxSizeMB: 5,
  allowedTypes: DEFAULT_ALLOWED_IMAGE_TYPES,
  maxFiles: 5,
};

export const DOCUMENT_UPLOAD_CONFIG: FileValidationOptions = {
  maxSizeMB: 10,
  allowedTypes: DEFAULT_ALLOWED_DOC_TYPES,
  maxFiles: 3,
};
