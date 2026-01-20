import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FaEdit, FaEye, FaChartBar, FaDownload } from 'react-icons/fa';
import {
  calculateMeanCoordinates,
  generateJobCode,
  parseCoordinateText,
  formatPolygonCoordinates,
  formatPolygonForDisplay,
} from './calculations';
import './App.css';

function App() {
  const [coordinateInput, setCoordinateInput] = useState('');
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [gapaNumber, setGapaNumber] = useState('');
  const [meanCoordinates, setMeanCoordinates] = useState(null);
  const [jobCode, setJobCode] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [activeView, setActiveView] = useState('input');
  const [editableGA, setEditableGA] = useState('');

  const pdfContentRef = useRef(null);
  const leftBarcodeRef = useRef(null);

  const handleParseCoordinates = () => {
    console.log('Parse clicked, input:', coordinateInput);
    const parsed = parseCoordinateText(coordinateInput);
    console.log('Parsed result:', parsed);
    setPolygonPoints(parsed);
    setMeanCoordinates(null);
    setIsGenerated(false);
    if (parsed.length === 0) {
      console.warn('No valid coordinates found. Please check your input format.');
    }
  };

  const handleCalculateMean = () => {
    console.log('Calculate Mean clicked, polygonPoints:', polygonPoints);
    if (polygonPoints.length > 0) {
      const mean = calculateMeanCoordinates(polygonPoints);
      console.log('Calculated mean:', mean);
      setMeanCoordinates(mean);
      setEditableGA(mean.ga);
      setIsGenerated(false);
    } else {
      console.warn('Calculate Mean attempted but no polygon points.');
    }
  };

  const handleGenerate = () => {
    console.log('Generate clicked, gapaNumber:', gapaNumber, 'meanCoordinates:', meanCoordinates);
    if (!gapaNumber.trim()) {
      console.warn('Generate failed: missing GAPA Number');
      return;
    }
    if (!meanCoordinates) {
      console.warn('Generate failed: mean coordinates not calculated');
      return;
    }
    const newJobCode = generateJobCode(gapaNumber);
    console.log('Generated jobCode:', newJobCode);
    setJobCode(newJobCode);
    setIsGenerated(true);
    setActiveView('preview');
  };

  useEffect(() => {
    // Ensure barcode is rendered whenever preview is active (SVG may remount when switching views)
    if (isGenerated && editableGA && activeView === 'preview' && leftBarcodeRef.current) {
      JsBarcode(leftBarcodeRef.current, editableGA, {
        format: 'CODE128',
        width: 2,
        height: 80,
        displayValue: false,
      });
    }
  }, [isGenerated, editableGA, activeView]);

  const handleExportPDF = async () => {
    if (!isGenerated) {
      console.warn('Export attempted before generation.');
      return;
    }
    try {
      const element = pdfContentRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      pdf.save(`lands-commission-${gapaNumber}-${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF', error);
    }
  };

  const handleReset = () => {
    setCoordinateInput('');
    setPolygonPoints([]);
    setGapaNumber('');
    setMeanCoordinates(null);
    setJobCode('');
    setEditableGA('');
    setIsGenerated(false);
    setActiveView('input');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>LC Workspace</h2>
          <p>Land Commission</p>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeView === 'input' ? 'active' : ''}`} onClick={() => setActiveView('input')}>
            <FaEdit className="nav-icon" /> Input Data
          </button>
          <button className={`nav-item ${activeView === 'preview' ? 'active' : ''}`} onClick={() => setActiveView('preview')} disabled={!isGenerated}>
            <FaEye className="nav-icon" /> Preview
          </button>
          <button className={`nav-item ${activeView === 'stats' ? 'active' : ''}`} onClick={() => setActiveView('stats')}>
            <FaChartBar className="nav-icon" /> Statistics
          </button>
        </nav>
        <div className="sidebar-bottom">
          {meanCoordinates && (
            <div className="sidebar-info">
              <h3>Current Mean</h3>
              <div className="info-box">
                <p><strong>E:</strong> <span className="info-value">{meanCoordinates.easting.toFixed(6)}</span></p>
                <p><strong>N:</strong> <span className="info-value">{meanCoordinates.northing.toFixed(6)}</span></p>
                <p><strong>GA:</strong> <span className="info-value">{editableGA}</span></p>
              </div>
            </div>
          )}

          {polygonPoints.length > 0 && (
            <div className="sidebar-info">
              <h3>Polygon Info</h3>
              <div className="info-box">
                <p><strong>Points:</strong> <span className="info-value">{polygonPoints.length}</span></p>
                {gapaNumber && <p><strong>GAPA:</strong> <span className="info-value">{gapaNumber}</span></p>}
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="app-header">
          <h1>Lands Commission - Polygon Workspace Tool</h1>
          <p>Land Polygon Coordinate Processor Both Bar Codes and QR Codes</p>
        </header>

        {activeView === 'input' && (
          <div className="content-section">
            <div className="input-panel">
              <div className="form-group">
                <label>Polygon Coordinates (Eastings, Northings)</label>
                <textarea
                  value={coordinateInput}
                  onChange={(e) => setCoordinateInput(e.target.value)}
                  onBlur={handleParseCoordinates}
                  onPaste={(e) => { setTimeout(handleParseCoordinates, 50); }}
                  placeholder="WKT Format: POLYGON((E1 N1, E2 N2, E3 N3, E1 N1))&#10;Or line format:&#10;123456.789 234567.890&#10;123567.890 234678.901"
                  rows="10"
                />
                <button onClick={handleParseCoordinates} className="btn-secondary">Parse Coordinates</button>
              </div>

              {polygonPoints.length > 0 && (
                <div className="form-group">
                  <label>Parsed Points ({polygonPoints.length})</label>
                  <div className="coordinate-display">{formatPolygonForDisplay(polygonPoints)}</div>
                </div>
              )}

              <div className="form-group">
                <label>GAPA Number</label>
                <input type="text" value={gapaNumber} onChange={(e) => setGapaNumber(e.target.value)} placeholder="Enter GAPA Number" />
              </div>

              <div className="button-group">
                <button onClick={handleCalculateMean} className="btn-primary" disabled={polygonPoints.length === 0}>Calculate Mean</button>
                <button onClick={handleGenerate} className="btn-primary" disabled={!meanCoordinates || !gapaNumber}>Generate Codes</button>
                <button onClick={handleReset} className="btn-secondary">Reset</button>
              </div>

              {meanCoordinates && (
                <div className="mean-display">
                  <h3>Calculated Mean Coordinates:</h3>
                  <div className="mean-values">
                    <div className="mean-item">
                      <label>Easting (E):</label>
                      <input type="text" value={meanCoordinates.easting.toFixed(6)} readOnly />
                    </div>
                    <div className="mean-item">
                      <label>Northing (N):</label>
                      <input type="text" value={meanCoordinates.northing.toFixed(6)} readOnly />
                    </div>
                    <div className="mean-item full-width">
                      <label>Job Code (Mean):</label>
                      <input type="text" value={editableGA} onChange={(e) => setEditableGA(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {isGenerated && (
                <button onClick={handleExportPDF} className="btn-export">
                  <FaDownload className="btn-icon" /> Download PDF
                </button>
              )}
            </div>
          </div>
        )}

        {activeView === 'preview' && isGenerated && (
          <div className="content-section preview-view">
            <div className="preview-header">
              <h2 className="preview-title">A4 Sheet preview</h2>
              <button onClick={handleExportPDF} className="btn-download-green" title="Download PDF">
                <FaDownload className="btn-icon" />
                <span>Download PDF</span>
              </button>
            </div>
            <div className="preview-container">
              <div className="a4-preview" ref={pdfContentRef}>
                <div className="a4-left-group">
                  {/** Left QR on top-left */}
                  <div className="qr-left">
                    {polygonPoints && polygonPoints.length > 0 && (
                      <QRCodeSVG value={formatPolygonCoordinates(polygonPoints)} size={130} level="H" />
                    )}
                  </div>

                  {/** Small barcode under left QR */}
                  <div className="barcode-small">
                    <svg ref={leftBarcodeRef}></svg>
                  </div>

                  {/** GA text under the barcode */}
                  <div className="ga-left">{editableGA}</div>
                </div>

                {/** Right QR on top-right */}
                <div className="a4-right-group">
                  <div className="qr-left qr-right">
                    <QRCodeSVG value={gapaNumber} size={130} level="H" />
                  </div>
                </div>

              </div>
            </div>
            <button onClick={handleExportPDF} className="btn-export">
              <FaDownload className="btn-icon" /> Download PDF
            </button>
          </div>
        )}

        {activeView === 'stats' && (
          <div className="content-section">
            <div className="stats-container">
              <h2 className="stats-heading">Statistics</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Points</h3>
                  <p className="stat-value">{polygonPoints.length}</p>
                </div>
                <div className="stat-card">
                  <h3>GAPA Number</h3>
                  <p className="stat-value">{gapaNumber || 'Not set'}</p>
                </div>
                <div className="stat-card">
                  <h3>Status</h3>
                  <p className="stat-value">{isGenerated ? '✅ Ready' : '⏳ Pending'}</p>
                </div>
              </div>
              {meanCoordinates && (
              <div className="stats-detail">
                <h3>Mean Coordinates Details</h3>
                <table className="stats-table">
                  <tbody>
                    <tr><td><strong>Mean Easting (E):</strong></td><td>{meanCoordinates.easting.toFixed(6)}</td></tr>
                    <tr><td><strong>Mean Northing (N):</strong></td><td>{meanCoordinates.northing.toFixed(6)}</td></tr>
                    <tr><td><strong>GA (E - N):</strong></td><td>{editableGA}</td></tr>
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
