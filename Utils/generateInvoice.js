import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { Writable } from "stream";

/**
 * Generates an invoice PDF and returns a buffer and path.
 * @param {object} order - Order data with user, address, items.
 * @param {string} [fileName] - Optional file name for the PDF.
 * @returns {Promise<{ buffer: Buffer, path: string }>}
 */
export const generateInvoicePDF = async (order, fileName) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 45 });
      const buffers = [];

      const bufferStream = new Writable();
      bufferStream._write = (chunk, encoding, callback) => {
        buffers.push(chunk);
        callback();
      };

      bufferStream.on("finish", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve({ buffer: pdfBuffer, path: invoicePath });
      });
      bufferStream.on("error", reject);

      doc.pipe(bufferStream);

      // ---------------- DIRECTORY ----------------
      const invoicesDir = path.join("/tmp", "invoices");
      if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

      // File name logic
      const invoicePath = path.join(invoicesDir, fileName || `INV-${order._id}.pdf`);

      // ---------------- PDF CONTENT ----------------
      const primary = "#FFFFFF";
      const accent = "#D9D9D9";
      const soft = "#5a189a";
      const text = "#111111";

      // Header
      doc.fillColor(soft).fontSize(28).text("LABEL AADVI", { align: "center" });
      doc.fontSize(10).fillColor("#444")
        .text("No.1, near Thangalakshmi Jewellery, Palladam, Tamil Nadu 641664", { align: "center" })
        .text("Phone: +91 8807427126", { align: "center" });
      doc.moveDown(1.5);

      // Invoice box
      let boxY = doc.y;
      doc.roundedRect(40, boxY, 520, 70, 10).fill(soft).stroke(accent);
      doc.fillColor(primary).fontSize(22).text("INVOICE", 60, boxY + 30);
      doc.fontSize(12).fillColor(primary)
        .text(`Invoice No: INV-${order._id}`, 380, boxY + 15)
        .text(`Date: ${new Date().toLocaleDateString()}`, 380, boxY + 45);

      doc.moveDown(5);

      // Bill To box
      let customerBoxY = doc.y;
      doc.roundedRect(40, customerBoxY, 520, 110, 10).fill(accent).stroke(accent);
      doc.fillColor(text).fontSize(16).text("BILL TO", 60, customerBoxY + 12);
      doc.fontSize(12)
        .text(`Name: ${order.user?.firstName || ""} ${order.user?.lastName || ""}`, 60, customerBoxY + 35)
        .text(`Email: ${order.user?.email || "N/A"}`, 60, customerBoxY + 55)
        .text(`Phone: ${order.address?.phone || "N/A"}`, 60, customerBoxY + 75);

      const rightX = 320;
      const addressText = `${order.address?.street || ""}, ${order.address?.city || ""}, ${order.address?.state || ""} - ${order.address?.pincode || ""}`;
      doc.fontSize(11).fillColor("#333")
        .text("Address:", rightX, customerBoxY + 35)
        .text(addressText, rightX, customerBoxY + 55, { width: 220 });

      doc.moveDown(6);

      // Order Details card
      let detailsBoxY = doc.y;
      const boxWidth = 520, boxHeight = 40, boxX = 40;
      doc.roundedRect(boxX, detailsBoxY, boxWidth, boxHeight, 10).fill(soft).stroke(accent);
      const texts = "ORDER DETAILS";
      const textWidth = doc.widthOfString(texts);
      const textX = boxX + (boxWidth - textWidth) / 2;
      const textY = detailsBoxY + (boxHeight - doc.currentLineHeight()) / 2;
      doc.fillColor(primary).fontSize(16).text(texts, textX, textY);

      doc.y = detailsBoxY + boxHeight + 20;

      // Table header
      const headerCardY = doc.y, headerCardX = 40, headerCardWidth = 520, headerCardHeight = 35;
      doc.roundedRect(headerCardX, headerCardY, headerCardWidth, headerCardHeight, 10).fillAndStroke("#D9D9D9", "#D9D9D9");
      const col0 = 60, col1 = 100, col2 = 280, col3 = 370, col4 = 460;
      doc.font("Helvetica-Bold").fontSize(12).fillColor(text)
        .text("S.No", col0, headerCardY + 10)
        .text("Product", col1, headerCardY + 10)
        .text("Price", col2, headerCardY + 10)
        .text("Qty", col3, headerCardY + 10)
        .text("Total", col4, headerCardY + 10);

      doc.y = headerCardY + headerCardHeight + 10;

      // Table rows
      let rowY = doc.y, subtotal = 0;
      doc.font("Helvetica").fillColor(text);
      order.orderItems.forEach((item, index) => {
        const productName = item.product?.name || "Unknown Product";
        const price = item.price || 0;
        const qty = item.quantity || 1;
        const total = price * qty;
        subtotal += total;

        doc.text(String(index + 1), col0, rowY)
          .text(productName, col1, rowY, { width: 170 })
          .text(`${price.toFixed(2)}`, col2, rowY)
          .text(String(qty), col3, rowY)
          .text(`${total.toFixed(2)}`, col4, rowY);

        rowY += 22;
        doc.strokeColor("#E5E7EB").moveTo(40, rowY).lineTo(550, rowY).stroke();
      });

      doc.y = rowY + 30;

      // Tax calculations
      const cgst = subtotal * 0.02;
      const sgst = subtotal * 0.02;
      const grandTotal = subtotal + cgst + sgst;

      // Total box
      let totalBoxY = doc.y;
      doc.roundedRect(300, totalBoxY, 260, 120, 12).fill("#F0F5FF").stroke("#D6E4FF");
      doc.fillColor("#333").fontSize(12)
        .text(`Subtotal: Rs ${subtotal.toFixed(2)}`, 320, totalBoxY + 15)
        .text(`CGST (2%): Rs ${cgst.toFixed(2)}`, 320, totalBoxY + 35)
        .text(`SGST (2%): Rs ${sgst.toFixed(2)}`, 320, totalBoxY + 55)
        .fontSize(14).fillColor("#000")
        .text(`Grand Total: Rs ${grandTotal.toFixed(2)}`, 320, totalBoxY + 85);

      // Footer
      doc.moveDown(6);
      doc.fontSize(10).fillColor("#888")
        .text("Thank you for shopping with LABEL AADVI!", { align: "center" })
        .text("For support, contact: labelaadvi@gmail.com", { align: "center" });

      doc.end();

    } catch (err) {
      console.error("PDF Error:", err);
      reject(err);
    }
  });
};
