import axios from "axios";
import FormData from "form-data";
import { Readable } from "stream";
import { PINATA_JWT } from "../config/environment";

export async function uploadToIPFS(
  data: Buffer | object,
  options: { filename: string; contentType: string }
) {
  const formData = new FormData();
  
  if (Buffer.isBuffer(data)) {
    const stream = Readable.from(data);
    formData.append("file", stream, options);
  } else {
    const stream = Readable.from(Buffer.from(JSON.stringify(data)));
    formData.append("file", stream, options);
  }

  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    formData,
    {
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        ...formData.getHeaders()
      },
      maxBodyLength: Infinity
    }
  );

  return `ipfs://${response.data.IpfsHash}`;
} 