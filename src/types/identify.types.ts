import { LinkPrecedence } from "@prisma/client";

/** Request body for POST /identify */
export interface IdentifyRequestBody {
  email?: string | null;
  phoneNumber?: string | null;
}

/** Response shape for POST /identify */
export interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

/** Internal contact shape (non-null where applicable) */
export interface ContactRecord {
  id: number;
  phoneNumber: string | null;
  email: string | null;
  linkedId: number | null;
  linkPrecedence: LinkPrecedence;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
