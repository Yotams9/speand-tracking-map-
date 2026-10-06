// Explicitly authorized fixed recovery namespaces. No arbitrary path override.
export const VISION_VALIDATION_RUN = 'validation-20261006-one'
export const VISION_POST_PARSER_RUN = 'validation-20261006-two'
export function visionNativeRunDirectory(run: string | undefined): string | null {
  if (run === undefined) return 'receipt-vision-local-capture'
  if (run === VISION_VALIDATION_RUN) return 'receipt-vision-local-validation-20261006-one'
  if (run === VISION_POST_PARSER_RUN) return 'receipt-vision-local-validation-20261006-two'
  return null
}
