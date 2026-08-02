// Sample binary buffer representing PNG header (89 50 4E 47 0D 0A 1A 0A)
const mockBinaryData = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x07, 0x80, 0x00, 0x00, 0x04, 0x38,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x57, 0x4e, 0x07
]);

function renderHexEditor() {
  const hexGrid = document.getElementById("hexGrid");
  let output = "OFFSET    00 01 02 03 04 05 06 07  ASCII\n---------------------------------------\n";

  for (let i = 0; i < mockBinaryData.length; i += 8) {
    const offsetStr = i.toString(16).padStart(8, '0').toUpperCase();
    let hexBytes = "";
    let asciiChars = "";

    for (let j = 0; j < 8; j++) {
      if (i + j < mockBinaryData.length) {
        const byte = mockBinaryData[i + j];
        hexBytes += byte.toString(16).padStart(2, '0').toUpperCase() + " ";
        asciiChars += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : ".";
      }
    }

    output += `${offsetStr}  ${hexBytes.padEnd(24, ' ')} ${asciiChars}\n`;
  }

  hexGrid.textContent = output;

  // Parse Struct Header
  const structParsed = document.getElementById("structParsed");
  const view = new DataView(mockBinaryData.buffer);

  const magic = mockBinaryData.slice(1, 4).reduce((acc, b) => acc + String.fromCharCode(b), "");
  const width = view.getUint32(16, false); // Big endian
  const height = view.getUint32(20, false);

  structParsed.innerHTML = `
struct PNG_Header {
  uint8_t  magic_signature[8] = 89 50 4E 47... ("${magic}");
  uint32_t chunk_length     = ${view.getUint32(8, false)};
  char     chunk_type[4]    = "IHDR";
  uint32_t image_width      = ${width} px;
  uint32_t image_height     = ${height} px;
  uint8_t  bit_depth        = 8;
  uint8_t  color_type       = 6 (RGBA);
};
  `;
}

document.addEventListener("DOMContentLoaded", renderHexEditor);
