import "dotenv/config";
import { prisma } from "../lib/prisma";
import { walkBlocks } from "../lib/page-builder/data";
import { prepareDocument } from "../lib/page-builder/document";

try {
  const rows = await prisma.pageLocale.findMany({ select: { locale: true, draft: true, page: { select: { kind: true } } } });
  for (const row of rows) {
    let missingBefore = 0;
    let missingAfter = 0;
    walkBlocks(row.draft as never, (block) => { if (!block.props?.id) missingBefore++; });
    const prepared = prepareDocument(row.draft);
    if (prepared.ok) walkBlocks(prepared.data, (block) => { if (!block.props.id) missingAfter++; });
    console.log({ kind: row.page.kind, locale: row.locale, missingBefore, missingAfter, valid: prepared.ok, ...(!prepared.ok ? { error: prepared.error } : {}) });
  }
} finally {
  await prisma.$disconnect();
}
