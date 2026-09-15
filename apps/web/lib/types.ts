export type Tag = { id: string; name: string };

export type Note = {
  id: string;
  title: string;
  content_markdown?: string;
  asset_base_url?: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
};

export type ApiError = { error?: { code: string; message: string } };
