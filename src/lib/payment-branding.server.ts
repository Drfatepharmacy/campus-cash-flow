export async function paymentBranding(db: any, association: any, bannerPath?: string | null) {
  const sign = async (path: string | null | undefined) => {
    if (!path) return null;
    const { data } = await db.storage.from("association-branding").createSignedUrl(path, 3600);
    return data?.signedUrl ?? null;
  };
  const [logo_url, banner_url] = await Promise.all([sign(association?.branding_logo_path), sign(bannerPath)]);
  return { logo_url: logo_url || association?.logo_url || null, banner_url, association_name: association?.name ?? null };
}