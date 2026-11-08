export async function prepareAvatar(file: File): Promise<{ blob: Blob; preview: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Wähle ein JPG-, PNG- oder WebP-Bild.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Das Bild darf höchstens 8 MB groß sein.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 50000000
    )
      throw new Error('Dieses Bild ist zu groß oder beschädigt.');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Dein Browser kann das Profilbild nicht vorbereiten.');
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    context.drawImage(
      image,
      (image.naturalWidth - size) / 2,
      (image.naturalHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))),
        'image/webp',
        0.84,
      ),
    );
    if (blob.type !== 'image/webp' || blob.size > 150000)
      throw new Error('Bitte wähle ein kleineres Bild oder verwende einen aktuellen Browser.');
    const preview = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      r.readAsDataURL(blob);
    });
    return { blob, preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}
