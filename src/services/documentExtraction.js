const mammoth = require('mammoth');
const { PDFParse } = require('pdf-parse');

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_CHARACTERS = 1_000_000;

async function extractDocumentText({ buffer, formatType }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw httpError('Document content is required', 400);
  if (buffer.length > MAX_DOCUMENT_BYTES) throw httpError('PDF and DOCX imports are limited to 5 MB', 413);

  let text;
  if (formatType === 'docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else if (formatType === 'pdf') {
    const parser = new PDFParse({ data:buffer });
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  } else {
    throw httpError('Only PDF and DOCX documents can be extracted', 400);
  }

  const normalized = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) throw httpError('No readable text was found in the document', 422);
  if (normalized.length > MAX_EXTRACTED_CHARACTERS) throw httpError('Extracted document text is too large', 413);
  return normalized;
}

function decodeBase64Document(value) {
  const encoded = String(value || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!encoded || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) throw httpError('Valid base64 document content is required', 400);
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw httpError('Document content is required', 400);
  if (buffer.length > MAX_DOCUMENT_BYTES) throw httpError('PDF and DOCX imports are limited to 5 MB', 413);
  return buffer;
}

function httpError(message, status) { const error=new Error(message); error.status=status; return error; }

module.exports = { MAX_DOCUMENT_BYTES, decodeBase64Document, extractDocumentText };
