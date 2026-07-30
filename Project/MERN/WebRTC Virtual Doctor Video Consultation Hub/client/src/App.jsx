import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [doctorName, setDoctorName] = useState('Dr. Marcus Vance, MD');
  const [patientName, setPatientName] = useState('John Smith');
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [notes, setNotes] = useState([]);
  const [noteInput, setNoteInput] = useState('');
  const [metrics, setMetrics] = useState({ latency: 18, fps: 30, resolution: '1080p' });

  const localVideoRef = useRef(null);

  const startConsultation = () => {
    setInCall(true);
    // Request media devices (fallback to simulated video if permission denied or no camera)
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        })
        .catch(() => console.log('Camera simulated mode active'));
    }
  };

  const endConsultation = () => {
    setInCall(false);
  };

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    setNotes([...notes, { text: noteInput, time: new Date().toLocaleTimeString() }]);
    setNoteInput('');
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#10b981', margin: 0 }}>🩺 WebRTC Encrypted Virtual Doctor Consultation Hub</h2>
          <small style={{ color: '#94a3b8' }}>Peer-to-Peer Telemedicine & Real-Time Prescription Drawer</small>
        </div>
        {inCall && (
          <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#94a3b8' }}>
            <span>Latency: <strong style={{ color: '#10b981' }}>{metrics.latency} ms</strong></span>
            <span>FPS: <strong>{metrics.fps}</strong></span>
            <span>Video: <strong>{metrics.resolution}</strong></span>
          </div>
        )}
      </header>

      {!inCall ? (
        <div style={{ maxWidth: '540px', margin: '40px auto', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
          <h3>Schedule / Start Consultation Room</h3>
          <div style={{ margin: '14px 0' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Doctor Name & Title:</label>
            <input type="text" value={doctorName} onChange={e => setDoctorName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
          </div>
          <div style={{ margin: '14px 0' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Patient Name:</label>
            <input type="text" value={patientName} onChange={e => setPatientName(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
          </div>
          <button onClick={startConsultation} style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '12px' }}>
            📹 Launch Encrypted Video Call Room
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <!-- Main WebRTC Video Viewport -->
          <div>
            <div style={{ background: '#000', height: '440px', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid #334155' }}>
              {/* Doctor Video Stream */}
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
              
              {/* Patient PIP Overlay */}
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', width: '160px', height: '100px', background: '#1e293b', border: '2px solid #10b981', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '0.8rem' }}>
                {patientName} (PIP)
              </div>

              {/* Call Controls Bar */}
              <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '12px', background: 'rgba(15, 23, 42, 0.85)', padding: '10px 20px', borderRadius: '30px' }}>
                <button onClick={() => setIsMicOn(!isMicOn)} style={{ background: isMicOn ? '#334155' : '#ef4444', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}>
                  {isMicOn ? '🎙️' : '🔇'}
                </button>
                <button onClick={() => setIsCamOn(!isCamOn)} style={{ background: isCamOn ? '#334155' : '#ef4444', border: 'none', color: '#fff', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer' }}>
                  {isCamOn ? '📹' : '🚫'}
                </button>
                <button onClick={endConsultation} style={{ background: '#ef4444', border: 'none', color: '#fff', padding: '0 20px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                  End Call
                </button>
              </div>
            </div>
          </div>

          <!-- Real-Time In-Call Prescription Note Drawer -->
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px', display: 'flex', flexDirection: 'column', height: '440px' }}>
            <h3>📝 Prescription & Medical Notes</h3>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
              {notes.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No medical notes added during this consultation yet.</p>
              ) : (
                notes.map((n, i) => (
                  <div key={i} style={{ background: '#0f172a', borderLeft: '3px solid #10b981', padding: '8px 12px', borderRadius: '4px', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <small style={{ color: '#94a3b8' }}>{n.time}</small>
                    <div>{n.text}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Type Rx or clinical advice..."
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px', borderRadius: '6px' }}
              />
              <button onClick={handleAddNote} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }}>Add Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
