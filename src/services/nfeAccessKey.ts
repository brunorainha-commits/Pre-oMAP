// nfeAccessKey.ts
// NF-e Access Key extraction, validation and XML fetch service

export interface AccessKeyResult {
  key: string;           // 44-digit clean string
  formatted: string;     // spaced in groups of 4 for display
  valid: boolean;        // passed mod-11 check digit
  suspicious: boolean;   // found but check digit failed
}

export type XmlFetchStatus =
  | 'found'
  | 'not_configured'
  | 'not_found'
  | 'api_error';

export interface XmlFetchResult {
  status: XmlFetchStatus;
  xml?: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────────
// 1. KEY EXTRACTION
// ─────────────────────────────────────────────────────────────────

/**
 * Tries multiple strategies to find a 44-digit NF-e access key in text.
 */
export function extractAccessKeyFromText(text: string): AccessKeyResult | null {
  console.log('[nfeAccessKey] FULL TEXT TO PARSE:', text);
  const candidates: string[] = [];

  // Strategy A - 44 continuous digits
  const stripped = text.replace(/\s+/g, '');
  const contiguous = stripped.match(/\d{44}/g);
  if (contiguous) candidates.push(...contiguous);

  // Strategy B – near the label "CHAVE DE ACESSO"
  const chaveRegion = text.match(
    /chave\s+de\s+acesso[\s\S]{0,100}/i
  );
  if (chaveRegion) {
    const digits = chaveRegion[0].replace(/\D/g, '');
    if (digits.length >= 44) candidates.push(digits.substring(0, 44));
  }

  // Strategy C – 11 groups of 4 digits separated by spaces (DANFE layout)
  const blockPattern = /(\d{4}[\s-]){10}\d{4}/g;
  const blocks = text.match(blockPattern);
  if (blocks) {
    for (const b of blocks) {
      const digits = b.replace(/\D/g, '');
      if (digits.length === 44) candidates.push(digits);
    }
  }

  // Strategy D – key broken across lines (up to 3 lines)
  // Collapse consecutive digit/whitespace sequences and search
  const collapsed = text.replace(/[\r\n]+/g, ' ');
  const longSeq = collapsed.match(/\d[\d\s]{43,58}\d/g);
  if (longSeq) {
    for (const s of longSeq) {
      const digits = s.replace(/\D/g, '');
      if (digits.length === 44) candidates.push(digits);
    }
  }

  // Strategy E - aggressive sliding window over all digits
  const allDigits = text.replace(/\D/g, '');
  console.log('[nfeAccessKey] ALL DIGITS EXTRACTED:', allDigits);
  
  for (let i = 0; i <= allDigits.length - 44; i++) {
    const candidate = allDigits.substring(i, i + 44);
    // Basic heuristic: State code (11-53), Month (01-12)
    const state = parseInt(candidate.substring(0, 2));
    const month = parseInt(candidate.substring(4, 6));
    if (state >= 11 && state <= 53 && month >= 1 && month <= 12) {
      if (validateNfeCheckDigit(candidate)) {
        candidates.push(candidate);
      }
    }
  }

  // Pick first valid candidate, then first suspicious
  let firstSuspicious: string | null = null;
  for (const candidate of candidates) {
    if (validateNfeCheckDigit(candidate)) {
      return buildResult(candidate, true);
    } else if (!firstSuspicious) {
      firstSuspicious = candidate;
    }
  }

  if (firstSuspicious) return buildResult(firstSuspicious, false);
  return null;
}

function buildResult(key: string, valid: boolean): AccessKeyResult {
  return {
    key,
    formatted: key.match(/.{1,4}/g)?.join(' ') ?? key,
    valid,
    suspicious: !valid
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. CHECK DIGIT VALIDATION (Módulo 11 NF-e)
// ─────────────────────────────────────────────────────────────────

/**
 * Validates the 44th digit of a NF-e access key using the
 * standard Módulo 11 algorithm defined by SEFAZ.
 */
export function validateNfeCheckDigit(key: string): boolean {
  if (!/^\d{44}$/.test(key)) return false;
  
  // Prevent false positives from long sequences of zeros
  if (/0{15,}$/.test(key)) return false;

  let sum = 0;
  let weight = 2;
  for (let i = 42; i >= 0; i--) {
    sum += parseInt(key[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const expected = remainder < 2 ? 0 : 11 - remainder;
  return expected === parseInt(key[43]);
}

// ─────────────────────────────────────────────────────────────────
// 3. XML FETCH LAYER — ready for real API integration
// ─────────────────────────────────────────────────────────────────

/**
 * Attempts to retrieve the NF-e XML by its 44-digit access key.
 *
 * Integration points (configure via app settings):
 *   • Nuvem Fiscal  – https://nuvemfiscal.com.br
 *   • TecnoSpeed    – https://tecnospeed.com.br
 *   • Arquivei      – https://arquivei.com.br
 *   • NSDocs        – https://nsdocs.com.br
 *   • SEFAZ DistDFe – requires A1 digital certificate (future)
 */
export async function fetchXmlByAccessKey(
  accessKey: string
): Promise<XmlFetchResult> {
  const apiKey      = localStorage.getItem('precomap_nfe_api_key');
  const apiProvider = localStorage.getItem('precomap_nfe_api_provider');
  const apiUrl      = localStorage.getItem('precomap_nfe_api_url');

  // ── Not configured ─────────────────────────────────────────────
  if (!apiKey || !apiProvider) {
    return {
      status: 'not_configured',
      message:
        'Chave de acesso encontrada, mas a busca automática do XML ainda não está configurada. ' +
        'Envie o XML correspondente manualmente ou configure uma API fiscal nas Configurações.'
    };
  }

  // ── Call the configured provider ───────────────────────────────
  try {
    const endpoint =
      apiUrl ||
      buildDefaultEndpoint(apiProvider, accessKey);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/xml, text/xml'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          status: 'not_found',
          message: `XML não encontrado na API ${apiProvider} para a chave ${accessKey}.`
        };
      }
      return {
        status: 'api_error',
        message: `Erro HTTP ${response.status} ao buscar XML na API ${apiProvider}.`
      };
    }

    const xml = await response.text();
    if (!xml.includes('infNFe') && !xml.includes('nfeProc')) {
      return {
        status: 'api_error',
        message: 'A resposta da API não contém um XML NF-e válido.'
      };
    }

    return { status: 'found', xml, message: 'XML obtido com sucesso via API.' };

  } catch (err) {
    return {
      status: 'api_error',
      message: `Falha ao conectar com a API ${apiProvider}: ${(err as Error).message}`
    };
  }
}

function buildDefaultEndpoint(provider: string, key: string): string {
  switch (provider.toLowerCase()) {
    case 'nuvemfiscal':
      return `https://api.nuvemfiscal.com.br/nfe/${key}`;
    case 'tecnospeed':
      return `https://api.tecnospeed.com.br/nfe/consulta/${key}`;
    case 'arquivei':
      return `https://api.arquivei.com.br/v1/nfe/received?access_key=${key}`;
    default:
      return `https://api.${provider}.com.br/nfe/${key}`;
  }
}
