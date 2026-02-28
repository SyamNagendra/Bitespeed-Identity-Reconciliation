import { LinkPrecedence } from "@prisma/client";
import { prisma } from "../config/database";
import type { IdentifyRequestBody, IdentifyResponse } from "../types/identify.types";

/**
 * Identity Reconciliation Service.
 * Connects contacts by email/phone, keeps a single primary per cluster,
 * and returns a consolidated view.
 */
export async function identify(
  body: IdentifyRequestBody
): Promise<IdentifyResponse> {
  const email = body.email ?? null;
  const phoneNumber = body.phoneNumber ?? null;

  const existing = await findContactsByEmailOrPhone(email, phoneNumber);

  if (existing.length === 0) {
    const primary = await createPrimaryContact(email, phoneNumber);
    return buildResponse(primary.id, [primary]);
  }

  const cluster = await collectConnectedContacts(existing);
  const primary = ensureSinglePrimary(cluster);
  await persistPrimaryConversion(cluster, primary.id);

  let currentCluster = await loadClusterByPrimaryId(primary.id);
  const hasNewInfo = hasNewEmailOrPhone(currentCluster, primary, email, phoneNumber);
  if (hasNewInfo) {
    await createSecondaryContact(primary.id, email, phoneNumber, currentCluster);
    currentCluster = await loadClusterByPrimaryId(primary.id);
  }
  return buildResponse(primary.id, currentCluster);
}

async function findContactsByEmailOrPhone(
  email: string | null,
  phoneNumber: string | null
) {
  const conditions: Array<{ email?: string; phoneNumber?: string }> = [];
  if (email) conditions.push({ email });
  if (phoneNumber) conditions.push({ phoneNumber });

  if (conditions.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: conditions,
    },
    orderBy: { createdAt: "asc" },
  });
  return contacts;
}

async function collectConnectedContacts(
  seed: Array<{ id: number; linkedId: number | null }>
): Promise<Array<{ id: number; linkedId: number | null; email: string | null; phoneNumber: string | null; linkPrecedence: LinkPrecedence; createdAt: Date }>> {
  const idSet = new Set(seed.map((c) => c.id));
  let toProcess = [...seed];

  while (toProcess.length > 0) {
    const ids = toProcess.map((c) => c.id);
    const linked = await prisma.contact.findMany({
      where: {
        deletedAt: null,
        linkedId: { in: ids },
      },
    });
    const newIds = linked.filter((c) => !idSet.has(c.id)).map((c) => c.id);
    if (newIds.length === 0) break;
    newIds.forEach((id) => idSet.add(id));
    toProcess = linked;
  }

  const all = await prisma.contact.findMany({
    where: { id: { in: Array.from(idSet) }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  return all;
}

function ensureSinglePrimary(
  cluster: Array<{
    id: number;
    linkPrecedence: LinkPrecedence;
    linkedId: number | null;
    createdAt: Date;
    email: string | null;
    phoneNumber: string | null;
  }>
): {
  id: number;
  linkPrecedence: LinkPrecedence;
  linkedId: number | null;
  createdAt: Date;
  email: string | null;
  phoneNumber: string | null;
} {
  const primaries = cluster.filter((c) => c.linkPrecedence === LinkPrecedence.primary);
  if (primaries.length === 0) {
    const oldest = cluster[0];
    return { ...oldest, linkPrecedence: LinkPrecedence.primary, linkedId: null };
  }
  const byCreated = [...primaries].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  return byCreated[0];
}

async function persistPrimaryConversion(
  cluster: Array<{ id: number; linkPrecedence: LinkPrecedence; linkedId: number | null; createdAt: Date }>,
  primaryId: number
): Promise<void> {
  const primaries = cluster.filter((c) => c.linkPrecedence === LinkPrecedence.primary);
  const toConvert = primaries.filter((p) => p.id !== primaryId);
  const convertedIds = new Set(toConvert.map((c) => c.id));
  const secondariesToRepoint = cluster.filter(
    (c) => c.linkPrecedence === LinkPrecedence.secondary && c.linkedId != null && convertedIds.has(c.linkedId)
  );

  await prisma.$transaction([
    ...toConvert.map((c) =>
      prisma.contact.update({
        where: { id: c.id },
        data: { linkPrecedence: LinkPrecedence.secondary, linkedId: primaryId },
      })
    ),
    ...secondariesToRepoint.map((c) =>
      prisma.contact.update({
        where: { id: c.id },
        data: { linkedId: primaryId },
      })
    ),
  ]);
}

function hasNewEmailOrPhone(
  cluster: Array<{ email: string | null; phoneNumber: string | null }>,
  primary: { id: number },
  email: string | null,
  phoneNumber: string | null
): boolean {
  const emails = new Set(
    cluster.map((c) => c.email).filter((e): e is string => e != null && e !== "")
  );
  const phones = new Set(
    cluster.map((c) => c.phoneNumber).filter((p): p is string => p != null && p !== "")
  );
  const newEmail = email != null && email !== "" && !emails.has(email);
  const newPhone = phoneNumber != null && phoneNumber !== "" && !phones.has(phoneNumber);
  return newEmail || newPhone;
}

async function createPrimaryContact(
  email: string | null,
  phoneNumber: string | null
) {
  return prisma.contact.create({
    data: {
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      linkPrecedence: LinkPrecedence.primary,
    },
  });
}

async function createSecondaryContact(
  primaryId: number,
  email: string | null,
  phoneNumber: string | null,
  existingCluster: Array<{ email: string | null; phoneNumber: string | null }>
) {
  const emails = new Set(
    existingCluster.map((c) => c.email).filter((e): e is string => e != null && e !== "")
  );
  const phones = new Set(
    existingCluster.map((c) => c.phoneNumber).filter((p): p is string => p != null && p !== "")
  );
  const newEmail = email != null && email !== "" && !emails.has(email) ? email : undefined;
  const newPhone = phoneNumber != null && phoneNumber !== "" && !phones.has(phoneNumber) ? phoneNumber : undefined;
  if (!newEmail && !newPhone) return;

  await prisma.contact.create({
    data: {
      email: newEmail ?? (email || undefined),
      phoneNumber: newPhone ?? (phoneNumber || undefined),
      linkedId: primaryId,
      linkPrecedence: LinkPrecedence.secondary,
    },
  });
}

async function loadClusterByPrimaryId(primaryId: number) {
  const all = await prisma.contact.findMany({
    where: {
      deletedAt: null,
      OR: [
        { id: primaryId },
        { linkedId: primaryId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const secondaryIds = new Set(
    all.filter((c) => c.linkedId === primaryId).map((c) => c.id)
  );
  let expanded = new Set(all.map((c) => c.id));
  let toProcess = [...secondaryIds];
  while (toProcess.length > 0) {
    const next = await prisma.contact.findMany({
      where: { linkedId: { in: toProcess }, deletedAt: null },
    });
    const newIds = next.filter((c) => !expanded.has(c.id)).map((c) => c.id);
    if (newIds.length === 0) break;
    newIds.forEach((id) => expanded.add(id));
    toProcess = newIds;
  }
  return prisma.contact.findMany({
    where: { id: { in: Array.from(expanded) }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}

function buildResponse(
  primaryContactId: number,
  cluster: Array<{ id: number; email: string | null; phoneNumber: string | null; linkPrecedence: LinkPrecedence }>
): IdentifyResponse {
  const emails = new Set<string>();
  const phoneNumbers = new Set<string>();
  const secondaryContactIds: number[] = [];

  for (const c of cluster) {
    if (c.email != null && c.email !== "") emails.add(c.email);
    if (c.phoneNumber != null && c.phoneNumber !== "") phoneNumbers.add(c.phoneNumber);
    if (c.id !== primaryContactId) secondaryContactIds.push(c.id);
  }

  return {
    contact: {
      primaryContactId,
      emails: Array.from(emails).sort(),
      phoneNumbers: Array.from(phoneNumbers).sort(),
      secondaryContactIds: secondaryContactIds.sort((a, b) => a - b),
    },
  };
}
