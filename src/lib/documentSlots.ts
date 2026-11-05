import type { DocumentType } from './vendorPortal'

/** The KYC documents a vendor uploads, in display order; `type` is the API's document type. */
export const DOCUMENT_SLOTS = [
  {
    id: 'card-front',
    type: 'GHANA_CARD_FRONT' as DocumentType,
    title: 'Ghana Card (front)',
    hint: 'The side with your photo. All four corners in the picture, no glare.',
    fileType: 'JPG',
    optional: false,
  },
  {
    id: 'card-back',
    type: 'GHANA_CARD_BACK' as DocumentType,
    title: 'Ghana Card (back)',
    hint: 'The side with the barcode.',
    fileType: 'JPG',
    optional: false,
  },
  {
    id: 'stall-photo',
    type: 'STALL_PHOTO' as DocumentType,
    title: 'Photo of stall',
    hint: 'Your stall or shop front, with your goods on display.',
    fileType: 'JPG',
    optional: false,
  },
  {
    id: 'business-reg',
    type: 'BUSINESS_REG' as DocumentType,
    title: 'Business registration',
    hint: 'Optional. A photo or PDF of your certificate, if you have one.',
    fileType: 'PDF',
    optional: true,
  },
] as const

export type DocumentSlotId = (typeof DOCUMENT_SLOTS)[number]['id']

export const REQUIRED_DOCUMENTS = DOCUMENT_SLOTS.filter((slot) => !slot.optional)
