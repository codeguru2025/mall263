import { api } from './api';

export type DocType =
  | 'DRIVERS_LICENSE'
  | 'POLICE_CLEARANCE'
  | 'PROOF_OF_RESIDENCE'
  | 'CAR_REG_BOOK'
  | 'INSURANCE'
  | 'ZINARA'
  | 'NATIONAL_ID';

export type DocStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';

export interface DriverDocument {
  id: string;
  type: DocType;
  fileUrl: string;
  status: DocStatus;
  rejectedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentsStatus {
  documents: DriverDocument[];
  kycVerified: boolean;
  onboardingComplete: boolean;
  approvedCount: number;
  totalRequired: number;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  DRIVERS_LICENSE: "Driver's License",
  NATIONAL_ID: 'National ID',
  POLICE_CLEARANCE: 'Police Clearance',
  PROOF_OF_RESIDENCE: 'Proof of Residence',
  CAR_REG_BOOK: 'Vehicle Registration Book',
  INSURANCE: 'Insurance Certificate',
  ZINARA: 'ZINARA Certificate',
};

export const ALL_DOC_TYPES: DocType[] = [
  'DRIVERS_LICENSE',
  'NATIONAL_ID',
  'POLICE_CLEARANCE',
  'PROOF_OF_RESIDENCE',
  'CAR_REG_BOOK',
  'INSURANCE',
  'ZINARA',
];

export const driverDocsApi = {
  submit: (type: DocType, fileUrl: string) =>
    api.post<DriverDocument>('/api/v1/driver/documents', { type, fileUrl }).then((r) => r.data),

  getMyDocuments: () =>
    api.get<DocumentsStatus>('/api/v1/driver/documents').then((r) => r.data),
};
