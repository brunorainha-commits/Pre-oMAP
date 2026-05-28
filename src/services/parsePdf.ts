// PDF Parser service (parsePdf.ts)

import * as pdfjsLib from 'pdfjs-dist';
import type { NormalizedInvoice } from './db';
import { getNormalizedDescription } from './db';

// Use UNPKG CDN for the worker matching the pdfjs-dist version
const pdfjsVersion = pdfjsLib.version || '4.10.38';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

export async function parsePdfInvoice(pdfBuffer: ArrayBuffer, fileName: string): Promise<NormalizedInvoice> {
  let rawText = '';
  let pagesText: string[] = [];

  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Sort text items by vertical position, then horizontal position
      const items: any[] = textContent.items;
      items.sort((a, b) => {
        if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
          return a.transform[4] - b.transform[4];
        }
        return b.transform[5] - a.transform[5];
      });

      // Group text items into lines
      let pageText = '';
      let currentY = -1;
      
      for (const item of items) {
        if (currentY === -1) {
          currentY = item.transform[5];
        } else if (Math.abs(currentY - item.transform[5]) > 5) {
          pageText += '\n';
          currentY = item.transform[5];
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' ';
        }
        pageText += item.str;
      }
      
      pagesText.push(pageText);
      rawText += pageText + '\n';
    }
  } catch (err) {
    console.error('Error extracting PDF text', err);
    throw new Error('Falha ao extrair texto do PDF. O arquivo pode estar corrompido ou protegido.');
  }

  const cleanText = rawText.trim();

  // 1. Check if the PDF is scanned or empty
  if (cleanText.length < 100) {
    // PDF looks scanned or image
    return {
      id: `ord-${Math.random().toString(36).substring(2, 9)}`,
      source_file_name: fileName,
      source_file_type: 'pdf',
      invoice_key: null,
      invoice_number: null,
      order_number: null,
      issue_date: new Date().toISOString().split('T')[0],
      customer_name: 'Revisar Cliente PDF (Imagem/Escaneado)',
      customer_document: null,
      company_name: null,
      company_document: null,
      total_amount: 0,
      discount_amount: null,
      shipping_amount: null,
      status: 'review',
      confidence_score: 0.1, // extremely low
      items: [],
      raw_text: '[PDF Escaneado ou Imagem. Nenhum texto selecionável foi extraído]',
      raw_xml: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  // 2. Parsers/Heuristics
  let confidenceScore = 0.5; // Start baseline for text PDFs
  let invoiceNumber: string | null = null;
  let issueDate: string | null = null;
  let customerName = 'Revisar Cliente PDF';
  let customerDocument: string | null = null;
  let companyName: string | null = null;
  let companyDocument: string | null = null;
  let totalAmount = 0;
  let discountAmount: number | null = null;
  let shippingAmount: number | null = null;
  let invoiceKey: string | null = null;

  // Regex definitions
  const cnpjRegex = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
  const cpfRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
  const dateRegex = /\b\d{2}\/\d{2}\/\d{4}\b/g;

  // A. Extract all CNPJs/CPFs
  const allCnpjs = cleanText.match(cnpjRegex) || [];
  const allCpfs = cleanText.match(cpfRegex) || [];
  
  if (allCnpjs.length > 0) {
    companyDocument = allCnpjs[0] || null; // first CNPJ is normally issuer
    if (allCnpjs.length > 1) {
      customerDocument = allCnpjs[1] || null; // second is customer
      confidenceScore += 0.15;
    }
  } else if (allCpfs.length > 0) {
    customerDocument = allCpfs[0] || null;
    confidenceScore += 0.15;
  }

  // B. Extract Invoice Key (44 digit key in NFe)
  const keyMatch = cleanText.replace(/\s+/g, '').match(/\d{44}/);
  if (keyMatch) {
    invoiceKey = keyMatch[0];
    confidenceScore += 0.1;
  }

  // C. Extract Invoice/Order Number
  // Look for keywords: "Nº", "NUMERO", "NOTA", "FATURA", "PEDIDO"
  const numberPatterns = [
    /(?:nº|nota|numero|n\xba|nf-e|pedido)\s*:?\s*(\d{4,9})/i,
    /danfe\s+[\s\S]*?\b(\d{3}\.\d{3}\.\d{3})\b/i, // common DANFE formatting
    /nº\s*(\d+[\.\d-]*)/i
  ];
  for (const pattern of numberPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      invoiceNumber = match[1].replace(/\./g, '');
      confidenceScore += 0.1;
      break;
    }
  }

  // D. Extract Date
  const dates = cleanText.match(dateRegex);
  if (dates && dates.length > 0) {
    // Usually the first date is emission date or order date
    const parts = dates[0].split('/');
    issueDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
    confidenceScore += 0.1;
  } else {
    issueDate = new Date().toISOString().split('T')[0];
  }

  // E. Extract Customer and Issuer Names
  // Heuristics: Find lines with labels and take next line or next segment
  const lines = cleanText.split('\n');
  
  // Find customer name
  const destKeywords = [
    /destinatário/i,
    /razao social/i,
    /nome\s*\/\s*razao\s*social/i,
    /cliente/i,
    /comprador/i
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    for (const kw of destKeywords) {
      if (kw.test(line)) {
        // Look ahead in the next 1-2 lines
        for (let offset = 1; offset <= 2; offset++) {
          const checkLine = lines[i + offset];
          if (checkLine && checkLine.trim().length > 3 && !cnpjRegex.test(checkLine) && !dateRegex.test(checkLine)) {
            // Found a good candidate name
            // Remove labels
            customerName = checkLine.replace(/nome:|razao social:|cliente:/i, '').trim();
            matched = true;
            confidenceScore += 0.1;
            break;
          }
        }
      }
      if (matched) break;
    }
    if (matched) break;
  }

  // Issuer/Company name
  const issuerKeywords = [
    /emitente/i,
    /recebemos de/i,
    /prestador/i,
    /vendedor/i
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    for (const kw of issuerKeywords) {
      if (kw.test(line)) {
        for (let offset = 1; offset <= 3; offset++) {
          const checkLine = lines[i + offset];
          if (checkLine && checkLine.trim().length > 3 && !cnpjRegex.test(checkLine) && !checkLine.toLowerCase().includes('nº')) {
            companyName = checkLine.replace(/emitente:|vendedor:/i, '').trim();
            matched = true;
            break;
          }
        }
      }
      if (matched) break;
    }
    if (matched) break;
  }

  // Robust document-based overriding for Customer Name (fixes labels parsed as names)
  const isBadCustomerName = 
    customerName === 'Revisar Cliente PDF' || 
    customerName.includes('Razão Social') || 
    customerName.includes('CNPJ') || 
    customerName.includes('CPF') ||
    customerName.includes('Destinatário') || 
    customerName.includes('Inscrição') || 
    customerName.length > 50;

  if (isBadCustomerName && customerDocument) {
    let overriden = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(customerDocument)) {
        const parts = line.split(customerDocument);
        let nameCandidate = parts[0].trim();
        nameCandidate = nameCandidate
          .replace(/^(?:nome|razao\s+social|cliente|destinatario|razao|comprador)\s*\/?:?\s*/i, '')
          .replace(/^(?:nome\s*\/\s*razao\s*social)\s*\/?:?\s*/i, '')
          .trim();
        nameCandidate = nameCandidate.replace(/[\s\-\/]+$/, '').trim();

        if (nameCandidate.length > 3 && !/cnpj|cpf|inscricao|emissao/i.test(nameCandidate)) {
          customerName = nameCandidate;
          confidenceScore += 0.15;
          overriden = true;
          break;
        }
      }
    }

    // Fallback look above document line
    if (!overriden) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(customerDocument) && i > 0) {
          const above = lines[i - 1];
          if (above && above.trim().length > 3) {
            let nameCandidate = above.trim()
              .replace(/^(?:nome|razao\s+social|cliente|destinatario|razao|comprador)\s*\/?:?\s*/i, '')
              .replace(/^(?:nome\s*\/\s*razao\s*social)\s*\/?:?\s*/i, '')
              .trim();
            nameCandidate = nameCandidate.replace(/[\s\-\/]+$/, '').trim();

            if (nameCandidate.length > 3 && !/cnpj|cpf|inscricao|emissao|destinatario/i.test(nameCandidate)) {
              customerName = nameCandidate;
              confidenceScore += 0.1;
              break;
            }
          }
        }
      }
    }
  }

  // Robust document-based overriding for Issuer Name
  const isBadCompanyName = 
    !companyName || 
    companyName.includes('Emitente') || 
    companyName.includes('Razão Social') || 
    companyName.length > 50;

  if (isBadCompanyName && companyDocument) {
    let overriden = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(companyDocument)) {
        const parts = line.split(companyDocument);
        let nameCandidate = parts[0].trim();
        nameCandidate = nameCandidate
          .replace(/^(?:nome|razao\s+social|emitente|vendedor|prestador)\s*\/?:?\s*/i, '')
          .trim();
        nameCandidate = nameCandidate.replace(/[\s\-\/]+$/, '').trim();

        if (nameCandidate.length > 3 && !/cnpj|cpf|inscricao|emissao/i.test(nameCandidate)) {
          companyName = nameCandidate;
          overriden = true;
          break;
        }
      }
    }

    if (!overriden) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(companyDocument) && i > 0) {
          const above = lines[i - 1];
          if (above && above.trim().length > 3) {
            let nameCandidate = above.trim()
              .replace(/^(?:nome|razao\s+social|emitente|vendedor|prestador)\s*\/?:?\s*/i, '')
              .trim();
            nameCandidate = nameCandidate.replace(/[\s\-\/]+$/, '').trim();

            if (nameCandidate.length > 3 && !/cnpj|cpf|inscricao|emissao/i.test(nameCandidate)) {
              companyName = nameCandidate;
              break;
            }
          }
        }
      }
    }
  }

  // F. Total values (total, discount, shipping)
  const totalKeywords = [
    /valor total d[ao] nota/i,
    /valor total do documento/i,
    /total geral/i,
    /total da nota/i,
    /valor da nota/i,
    /total\s*R\$/i,
    /net amount/i
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matched = false;
    for (const kw of totalKeywords) {
      if (kw.test(line)) {
        // Extract money values in the line or next line
        const vals = line.match(/[\d\.,]+/g);
        if (vals) {
          // Look for the last value or the value containing comma
          for (let v = vals.length - 1; v >= 0; v--) {
            const valStr = vals[v].replace(/\./g, '').replace(',', '.');
            const valNum = parseFloat(valStr);
            if (!isNaN(valNum) && valNum > 1) {
              totalAmount = valNum;
              matched = true;
              confidenceScore += 0.1;
              break;
            }
          }
        }
      }
      if (matched) break;
    }
    if (matched) break;
  }

  // Look for discount and shipping
  const discKeywords = [/desconto/i, /vdesc/i];
  const shipKeywords = [/frete/i, /vfrete/i, /transporte/i];
  
  for (const line of lines) {
    for (const kw of discKeywords) {
      if (kw.test(line)) {
        const vals = line.match(/[\d\.,]+/g);
        if (vals && vals.length > 0) {
          const discVal = parseFloat(vals[vals.length - 1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(discVal) && discVal > 0) discountAmount = discVal;
        }
      }
    }
    for (const kw of shipKeywords) {
      if (kw.test(line)) {
        const vals = line.match(/[\d\.,]+/g);
        if (vals && vals.length > 0) {
          const shipVal = parseFloat(vals[vals.length - 1].replace(/\./g, '').replace(',', '.'));
          if (!isNaN(shipVal) && shipVal > 0) shippingAmount = shipVal;
        }
      }
    }
  }

  // G. Extract Items
  // Table item parsing: look for lines that resemble a product list row
  // Typically: [Code] [Description] [NCM] [CFOP] [Qty] [Unit] [Price] [Total]
  // We can look for lines that contain:
  // - A measurement unit (UN, SC, KG, GL, PCT, CX, M, L)
  // - A quantity (numeric)
  // - Unit price and total price (floats)
  const items: any[] = [];
  const units = ['un', 'sc', 'kg', 'gl', 'pct', 'cx', 'm', 'l', 'fd', 'lt', 'und'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length < 15) continue;

    // Check if line contains a quantity, a unit, and prices
    // Let's tokenise the line
    const tokens = line.split(/\s+/);
    if (tokens.length < 4) continue;

    const initialItemsCount = items.length;

    // Try to find a measurement unit token
    const unitIdx = tokens.findIndex(t => units.includes(t.toLowerCase()));
    if (unitIdx > 0 && unitIdx < tokens.length - 2) {
      // We found a unit!
      // Quantity is likely the token before the unit, or close
      const qtyStr = tokens[unitIdx - 1].replace(/\./g, '').replace(',', '.');
      const qty = parseFloat(qtyStr);

      // Price is likely the token after the unit
      const priceStr = tokens[unitIdx + 1].replace(/\./g, '').replace(',', '.');
      const price = parseFloat(priceStr);

      // Total is likely the token after price
      let total = price * qty;
      if (unitIdx + 2 < tokens.length) {
        const totalStr = tokens[unitIdx + 2].replace(/\./g, '').replace(',', '.');
        const checkTotal = parseFloat(totalStr);
        if (!isNaN(checkTotal) && Math.abs(checkTotal - total) < 5) {
          total = checkTotal;
        }
      }

      if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
        // Reconstruct description from the tokens before qty
        // Remove code if it looks like a code (e.g. INS-001 or numbers)
        let descTokens = tokens.slice(0, unitIdx - 1);
        let code: string | null = null;

        if (descTokens.length > 1 && /^[a-zA-Z0-9-]{3,12}$/.test(descTokens[0])) {
          code = descTokens[0];
          descTokens = descTokens.slice(1);
        }

        const description = descTokens.join(' ').trim();
        if (description.length > 3 && !description.toLowerCase().includes('valor') && !description.toLowerCase().includes('total')) {
          items.push({
            product_code: code,
            barcode: null,
            description,
            normalized_description: getNormalizedDescription(description),
            ncm: null,
            cfop: null,
            quantity: qty,
            unit: tokens[unitIdx].toUpperCase(),
            unit_price: price,
            total_price: total,
            discount: null
          });
        }
      }
    }

    // FALLBACK: Math relation parsing (Qty * Price = Total) for rows without unit tokens
    if (items.length === initialItemsCount) {
      // Merge "R$" with the next token if it's separate
      const cleanTokens: string[] = [];
      for (let t = 0; t < tokens.length; t++) {
        const token = tokens[t];
        if ((token === 'R$' || token === 'r$') && t + 1 < tokens.length) {
          cleanTokens.push('R$' + tokens[t + 1]);
          t++;
        } else {
          cleanTokens.push(token);
        }
      }

      const getNumericValue = (str: string): number => {
        const clean = str.replace(/r\$/i, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(clean);
      };

      let foundRelation = false;
      let itemTotal = 0;
      let itemPrice = 0;
      let itemQty = 0;
      let qtyIdx = -1;
      let priceIdx = -1;

      const L = cleanTokens.length;
      if (L >= 4) {
        for (let tIdx = L - 1; tIdx >= L - 2 && tIdx >= 0; tIdx--) {
          const totalVal = getNumericValue(cleanTokens[tIdx]);
          if (isNaN(totalVal) || totalVal <= 0) continue;

          for (let pIdx = tIdx - 1; pIdx >= tIdx - 3 && pIdx >= 0; pIdx--) {
            const priceVal = getNumericValue(cleanTokens[pIdx]);
            if (isNaN(priceVal) || priceVal <= 0 || priceVal >= totalVal) continue;

            for (let qIdx = pIdx - 1; qIdx >= pIdx - 3 && qIdx >= 0; qIdx--) {
              const qtyVal = getNumericValue(cleanTokens[qIdx]);
              if (isNaN(qtyVal) || qtyVal <= 0) continue;

              const expectedTotal = qtyVal * priceVal;
              // Allow small rounding differences (up to 1% or R$1.00)
              if (Math.abs(expectedTotal - totalVal) < 0.01 * totalVal || Math.abs(expectedTotal - totalVal) < 1.0) {
                itemTotal = totalVal;
                itemPrice = priceVal;
                itemQty = qtyVal;
                qtyIdx = qIdx;
                priceIdx = pIdx;
                foundRelation = true;
                break;
              }
            }
            if (foundRelation) break;
          }
          if (foundRelation) break;
        }
      }

      if (foundRelation) {
        let descTokens = cleanTokens.slice(0, qtyIdx);
        let ncm: string | null = null;
        let code: string | null = null;
        let cfop: string | null = null;
        let extractedUnit = 'UN';

        // Check if there is a unit token between qty and price (e.g. "5102 UN R$ 3.00")
        for (let u = qtyIdx + 1; u < priceIdx; u++) {
          const possibleUnit = cleanTokens[u].toLowerCase();
          if (units.includes(possibleUnit) || /^[a-zA-Z]{1,3}$/.test(possibleUnit)) {
            extractedUnit = possibleUnit.toUpperCase();
            break;
          }
        }

        const filteredDescTokens: string[] = [];
        for (const token of descTokens) {
          const cleanToken = token.trim();
          if (cleanToken.length === 0) continue;

          if (/\d{4}-\d{2}-\d{2}/.test(cleanToken) || /\d{2}\/\d{2}\/\d{4}/.test(cleanToken)) {
            continue;
          }
          if (/^\d{8}$/.test(cleanToken)) {
            ncm = cleanToken;
            continue;
          }
          if (/^[56]\d{3}$/.test(cleanToken)) {
            cfop = cleanToken;
            continue;
          }
          if (/^\d{3,4}$/.test(cleanToken)) {
            // Ignore small tax or CST/CSOSN codes like 0101, 060, etc.
            continue;
          }
          if (filteredDescTokens.length === 0 && /^[a-zA-Z0-9-]{3,12}$/.test(cleanToken) && !/^[0-9]+$/.test(cleanToken)) {
            code = cleanToken;
            continue;
          }
          filteredDescTokens.push(token);
        }

        const description = filteredDescTokens.join(' ').trim();
        if (description.length > 2 && !description.toLowerCase().includes('valor') && !description.toLowerCase().includes('total')) {
          items.push({
            product_code: code,
            barcode: null,
            description,
            normalized_description: getNormalizedDescription(description),
            ncm,
            cfop,
            quantity: itemQty,
            unit: extractedUnit,
            unit_price: itemPrice,
            total_price: itemTotal,
            discount: null
          });
        }
      }
    }
  }

  // If no items were extracted but we have total, let's create a placeholder item to review
  if (items.length === 0 && totalAmount > 0) {
    items.push({
      product_code: null,
      barcode: null,
      description: 'Revisar Produto PDF (Item Geral)',
      normalized_description: getNormalizedDescription('Revisar Produto PDF (Item Geral)'),
      ncm: null,
      cfop: null,
      quantity: 1,
      unit: 'UN',
      unit_price: totalAmount,
      total_price: totalAmount,
      discount: null
    });
  }

  // Cap confidence score
  confidenceScore = Math.max(0.2, Math.min(0.95, confidenceScore));

  return {
    id: `ord-${Math.random().toString(36).substring(2, 9)}`,
    source_file_name: fileName,
    source_file_type: 'pdf',
    invoice_key: invoiceKey,
    invoice_number: invoiceNumber,
    order_number: invoiceNumber ? `PED-${invoiceNumber}` : null,
    issue_date: issueDate,
    customer_name: customerName,
    customer_document: customerDocument,
    company_name: companyName,
    company_document: companyDocument,
    total_amount: totalAmount > 0 ? totalAmount : items.reduce((sum, item) => sum + item.total_price, 0),
    discount_amount: discountAmount,
    shipping_amount: shippingAmount,
    status: 'review',
    confidence_score: parseFloat(confidenceScore.toFixed(2)),
    items,
    raw_text: cleanText,
    raw_xml: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}
