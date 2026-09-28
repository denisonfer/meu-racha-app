import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type TPickedImage = {
  uri: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
};

const AVATAR_SIZE = 512;
const AVATAR_QUALITY = 0.8;

/** Galeria → recorte quadrado → 512×512 JPEG. null quando a pessoa cancela. */
export async function pickAvatar(): Promise<TPickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  const side = Math.min(asset.width, asset.height);
  const rendered = await ImageManipulator.manipulate(asset.uri)
    .crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    })
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();

  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: AVATAR_QUALITY,
  });

  return {
    uri: saved.uri,
    mimeType: "image/jpeg",
    width: saved.width,
    height: saved.height,
  };
}
