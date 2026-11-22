const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const relatorioService = require("../services/relatorioService");

function nomeSeguro(valor) {
  const nome = String(valor || "").trim()
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  return nome || "relatorio";
}

function formatarValor(valor) {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "object") return JSON.stringify(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (valor instanceof Date) return valor.toLocaleString("pt-BR");
  return String(valor);
}

async function gerarExcel(dados, nome, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "API WhatsApp";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Relatório");
  sheet.addRow([dados.titulo]);
  sheet.mergeCells(1, 1, 1, dados.colunas.length);
  sheet.getRow(1).font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F4E78" } };
  sheet.addRow(dados.colunas.map(([titulo]) => titulo));
  sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  dados.linhas.forEach((linha) => sheet.addRow(dados.colunas.map(([, campo]) => formatarValor(linha[campo]))));
  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: dados.colunas.length } };
  sheet.columns.forEach((coluna, indice) => {
    const maior = Math.max(
      String(dados.colunas[indice][0]).length,
      ...dados.linhas.slice(0, 200).map((linha) => formatarValor(linha[dados.colunas[indice][1]]).length)
    );
    coluna.width = Math.min(Math.max(maior + 2, 14), 42);
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nome)}.xlsx`);
  await workbook.xlsx.write(res);
  res.end();
}

function gerarPdf(dados, nome, res) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(nome)}.pdf`);
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, autoFirstPage: true });
  doc.pipe(res);
  doc.fontSize(16).font("Helvetica-Bold").text(dados.titulo, { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(8).font("Helvetica").text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
  doc.moveDown();

  dados.linhas.forEach((linha, indice) => {
    const yEstimado = doc.y;
    if (yEstimado > 500) doc.addPage();
    doc.fontSize(9).font("Helvetica-Bold").text(`Registro ${indice + 1}`, { underline: true });
    doc.fontSize(8).font("Helvetica");
    dados.colunas.forEach(([titulo, campo]) => {
      const valor = formatarValor(linha[campo]) || "—";
      doc.text(`${titulo}: ${valor}`, { width: 760, lineGap: 1 });
    });
    doc.moveDown(0.6);
  });
  if (!dados.linhas.length) doc.fontSize(10).text("Nenhum registro encontrado.");
  doc.end();
}

async function gerar(req, res, next) {
  try {
    const { tipo, formato } = req.params;
    if (!["logs", "historico", "usuarios"].includes(tipo)) {
      return res.status(400).json({ mensagem: "Tipo de relatório inválido." });
    }
    if (!["xlsx", "pdf"].includes(formato)) {
      return res.status(400).json({ mensagem: "Formato inválido. Escolha Excel ou PDF." });
    }
    const nome = nomeSeguro(req.query.nome);
    let filtros = {};
    if (req.query.filtros) {
      try {
        filtros = JSON.parse(req.query.filtros);
      } catch {
        return res.status(400).json({ mensagem: "Os filtros enviados para o relatório são inválidos." });
      }
    }
    if (!filtros || typeof filtros !== "object" || Array.isArray(filtros)) {
      return res.status(400).json({ mensagem: "Os filtros enviados para o relatório são inválidos." });
    }
    const dados = await relatorioService.obterDados(tipo, filtros);
    if (formato === "xlsx") return await gerarExcel(dados, nome, res);
    return gerarPdf(dados, nome, res);
  } catch (erro) {
    return next(erro);
  }
}

module.exports = { gerar };
