export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  updated: string;
  summary: string;
  sections: LegalSection[];
};
