import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { FaEdit, FaEye, FaChartBar, FaDownload, FaHistory, FaTrash } from 'react-icons/fa';
import {
  calculateMeanCoordinates,
  generateJobCode,
  parseCoordinateText,
  formatPolygonCoordinates,
  formatPolygonForDisplay,
} from './calculations';
import { saveGeneration, getAllGenerations, deleteGeneration, initDB } from './indexedDB';
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
  const [generationCount, setGenerationCount] = useState(() => {
    const saved = localStorage.getItem('lcGenerationCount');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [savedGenerations, setSavedGenerations] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFileName, setSaveFileName] = useState('');
  const [saveFileType, setSaveFileType] = useState('pdf');

  const pdfContentRef = useRef(null);
  const leftBarcodeRef = useRef(null);

  const handleParseCoordinates = (text) => {
    const parsed = parseCoordinateText(text);
    setPolygonPoints(parsed);
    setMeanCoordinates(null);
    setIsGenerated(false);
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
    
    // Debug: Check what will be encoded in QR codes
    const polygonData = formatPolygonCoordinates(polygonPoints);
    console.log('QR Code Data - Polygon:', polygonData);
    console.log('QR Code Data - GAPA:', gapaNumber.trim());
    console.log('Barcode Data - GA:', editableGA);
    
    const newJobCode = generateJobCode(gapaNumber);
    console.log('Generated jobCode:', newJobCode);
    setJobCode(newJobCode);
    setIsGenerated(true);
    setActiveView('preview');
    
    // Increment generation count and save to localStorage
    const newCount = generationCount + 1;
    setGenerationCount(newCount);
    localStorage.setItem('lcGenerationCount', newCount.toString());
  };

  useEffect(() => {
    // Initialize IndexedDB and load saved generations
    const loadGenerations = async () => {
      await initDB();
      const generations = await getAllGenerations();
      setSavedGenerations(generations);
    };
    loadGenerations();
  }, []);

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
      // Capture the preview with high quality
      const canvas = await html2canvas(element, { 
        scale: 3, 
        useCORS: true, 
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      
      // Create blob and open in new window for preview/download
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Open PDF in new window - user can preview and save from there
      window.open(pdfUrl, '_blank');
      
      // Save to IndexedDB
      await saveGeneration({
        gapaNumber,
        jobCode,
        meanCoordinates,
        polygonPoints,
        editableGA,
        pdfBlob,
      });
      
      // Refresh saved generations list
      const generations = await getAllGenerations();
      setSavedGenerations(generations);
      
      // Clean up the URL after a delay
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
    } catch (error) {
      console.error('Error generating PDF', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  const handleConfirmSave = async () => {
    if (!saveFileName.trim()) {
      alert('Please enter a filename');
      return;
    }
    
    try {
      const element = pdfContentRef.current;
      // Increased scale to 4 for crispy clean PDF quality
      const canvas = await html2canvas(element, { scale: 4, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/png', 1.0); // Use max quality
      
      if (saveFileType === 'pdf') {
        // Export as PDF with compression disabled for clarity
        const pdf = new jsPDF('p', 'mm', 'a4');
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        pdf.save(`${saveFileName}.pdf`);
        
        // Save to IndexedDB
        const pdfBlob = pdf.output('blob');
        await saveGeneration({
          gapaNumber,
          jobCode,
          meanCoordinates,
          polygonPoints,
          editableGA,
          pdfBlob,
        });
      } else if (saveFileType === 'doc') {
        // Export as DOC (HTML format that Word can open)
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${saveFileName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20mm; }
    .content { width: 170mm; margin: 0 auto; }
    img { max-width: 100%; height: auto; }
    h1 { color: #2c5f2d; }
    .info { margin: 20px 0; }
    .info p { margin: 5px 0; }
  </style>
</head>
<body>
  <div class="content">
    <h1>Polygon Workspace Tool Ghana</h1>
    <div class="info">
      <p><strong>GAPA Number:</strong> ${gapaNumber}</p>
      <p><strong>Job Code:</strong> ${jobCode}</p>
      <p><strong>GA:</strong> ${editableGA}</p>
      <p><strong>Mean Easting:</strong> ${meanCoordinates.easting.toFixed(6)}</p>
      <p><strong>Mean Northing:</strong> ${meanCoordinates.northing.toFixed(6)}</p>
      <p><strong>Total Points:</strong> ${polygonPoints.length}</p>
    </div>
    <div>
      <img src="${imgData}" alt="Polygon Workspace Preview" />
    </div>
  </div>
</body>
</html>`;
        
        const blob = new Blob([htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${saveFileName}.doc`;
        link.click();
        URL.revokeObjectURL(url);
        
        // Save to IndexedDB (as blob)
        await saveGeneration({
          gapaNumber,
          jobCode,
          meanCoordinates,
          polygonPoints,
          editableGA,
          pdfBlob: blob,
        });
      }
      
      // Refresh saved generations list
      const generations = await getAllGenerations();
      setSavedGenerations(generations);
      
      // Close modal
      setShowSaveModal(false);
    } catch (error) {
      console.error('Error generating file', error);
      alert('Error generating file. Please try again.');
    }
  };

  const handleDownloadSavedPDF = (record) => {
    if (record.pdfBlob) {
      const url = URL.createObjectURL(record.pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `polygon-workspace-${record.gapaNumber}-${record.timestamp}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteRecord = async (id) => {
    try {
      await deleteGeneration(id);
      const generations = await getAllGenerations();
      setSavedGenerations(generations);
    } catch (error) {
      console.error('Error deleting record', error);
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
      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Save Document</h2>
            <div className="modal-body">
              <div className="form-group">
                <label>File Name</label>
                <input
                  type="text"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  placeholder="Enter file name"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>File Type</label>
                <select
                  value={saveFileType}
                  onChange={(e) => setSaveFileType(e.target.value)}
                >
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="doc">Word Document (.doc)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowSaveModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleConfirmSave} className="btn-primary">
                <FaDownload className="btn-icon" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>LC Workspace</h2>
          <p>Polygon Workspace Tool Ghana</p>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeView === 'input' ? 'active' : ''}`} onClick={() => setActiveView('input')}>
            <FaEdit className="nav-icon" /> Input Data
          </button>
          <button className={`nav-item ${activeView === 'preview' ? 'active' : ''}`} onClick={() => setActiveView('preview')} disabled={!isGenerated}>
            <FaEye className="nav-icon" /> Preview
          </button>
          <button className={`nav-item ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
            <FaHistory className="nav-icon" /> History
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
          <h1>Polygon Workspace Tool Ghana</h1>
          <p>Land Polygon Coordinate Processor Both Bar Codes and QR Codes</p>
        </header>

        {activeView === 'input' && (
          <div className="content-section">
            <div className="input-panel">
              <div className="form-group">
                <label>Polygon Coordinates (Eastings, Northings)</label>
                <textarea
                  value={coordinateInput}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setCoordinateInput(newValue);
                    handleParseCoordinates(newValue);
                  }}
                  placeholder="WKT Format: POLYGON((E1 N1, E2 N2, E3 N3, E1 N1))&#10;Or line format:&#10;123456.789 234567.890&#10;123567.890 234678.901"
                  rows="10"
                />
              </div>

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
                  <div className="mean-values">
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
                    {polygonPoints && polygonPoints.length > 0 ? (
                      <QRCodeSVG 
                        value={formatPolygonCoordinates(polygonPoints) || 'No data'} 
                        size={110} 
                        level="M" 
                      />
                    ) : (
                      <div style={{width: 110, height: 110, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>No Data</div>
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
                    {gapaNumber && gapaNumber.trim() ? (
                      <QRCodeSVG 
                        value={gapaNumber.trim()} 
                        size={110} 
                        level="M" 
                      />
                    ) : (
                      <div style={{width: 110, height: 110, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>No GAPA</div>
                    )}
                  </div>
                </div>

              </div>
            </div>
            <button onClick={handleExportPDF} className="btn-export">
              <FaDownload className="btn-icon" /> Download PDF
            </button>
          </div>
        )}

        {activeView === 'history' && (
          <div className="content-section">
            <div className="stats-container">
              <h2 className="stats-heading">Generation History</h2>
              {savedGenerations.length === 0 ? (
                <div className="empty-state">
                  <FaHistory style={{ fontSize: '3rem', color: '#ccc', marginBottom: '1rem' }} />
                  <p>No saved generations yet.</p>
                  <p style={{ fontSize: '0.9rem', color: '#666' }}>Generate and export PDFs to see them here.</p>
                </div>
              ) : (
                <div className="history-list">
                  {savedGenerations.slice().reverse().map((record) => (
                    <div key={record.id} className="history-item">
                      <div className="history-info">
                        <h3>GAPA: {record.gapaNumber}</h3>
                        <p><strong>Job Code:</strong> {record.jobCode}</p>
                        <p><strong>GA:</strong> {record.editableGA}</p>
                        <p><strong>Date:</strong> {new Date(record.timestamp).toLocaleString()}</p>
                        <p><strong>Points:</strong> {record.polygonPoints?.length || 0}</p>
                      </div>
                      <div className="history-actions">
                        {record.pdfBlob && (
                          <button 
                            onClick={() => handleDownloadSavedPDF(record)} 
                            className="btn-primary"
                            title="Download PDF"
                          >
                            <FaDownload /> Download PDF
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteRecord(record.id)} 
                          className="btn-secondary"
                          title="Delete Record"
                        >
                          <FaTrash /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                <div className="stat-card">
                  <h3>Codes Generated</h3>
                  <p className="stat-value">{generationCount}</p>
                </div>
                <div className="stat-card">
                  <h3>Saved Records</h3>
                  <p className="stat-value">{savedGenerations.length}</p>
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
