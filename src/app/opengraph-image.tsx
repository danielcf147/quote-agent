import { renderShareImage, SHARE_IMAGE } from "@/lib/share-image";

export const alt = SHARE_IMAGE.alt;
export const size = SHARE_IMAGE.size;
export const contentType = SHARE_IMAGE.contentType;

export default function Image() {
  return renderShareImage();
}
