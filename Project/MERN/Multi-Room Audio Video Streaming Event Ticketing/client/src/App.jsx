import React, { useState } from 'react';

const mockEvent = {
  id: 'evt_101',
  title: 'Global Tech & AI Summit 2026',
  date: 'August 15, 2026',
  ticketPrice: 49.00,
  rooms: [
    { id: 'room-1', name: 'Stage Alpha: Keynote & AI Architectures', speaker: 'Dr. Sarah Vance', topic: 'LLM Multi-Agent Frameworks' },
    { id: 'room-2', name: 'Stage Beta: Web3 & Distributed Systems', speaker: 'Alex Rivers', topic: 'High-Throughput Consensus Engines' },
    { id: 'room-3', name: 'Stage Gamma: Cyber Security Workshops', speaker: 'Elena Rostova', topic: 'Zero-Trust Architecture in 2026' }
  ]
};

export default function App() {
  const [activeRoom, setActiveRoom] = useState(mockEvent.rooms[0]);
  const [ticketPass, setTicketPass] = useState(null);
  const [attendeeName, setAttendeeName] = useState('');
  const [polls, setPolls] = useState([
    { id: 1, question: 'Which topic are you most excited for?', votes: { AI: 45, Web3: 12, CyberSec: 28 } }
  ]);
  const [qaList, setQaList] = useState([
    { id: 101, user: 'Dev_Alex', text: 'Will slides be released after Stage Alpha?' }
  ]);
  const [qaInput, setQaInput] = useState('');

  const handleRegisterTicket = (e) => {
    e.preventDefault();
    if (!attendeeName.trim()) return;
    setTicketPass({
      ticket_id: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
      name: attendeeName,
      issuedAt: new Date().toLocaleDateString()
    });
  };

  const handleAddQuestion = () => {
    if (!qaInput.trim()) return;
    setQaList([...qaList, { id: Date.now(), user: attendeeName || 'Anonymous', text: qaInput }]);
    setQaInput('');
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#38bdf8', margin: 0 }}>🎪 {mockEvent.title}</h2>
          <small style={{ color: '#94a3b8' }}>Live Multi-Track Event Portal • {mockEvent.date}</small>
        </div>
        {ticketPass && (
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', padding: '8px 14px', borderRadius: '8px', color: '#10b981', fontSize: '0.85rem' }}>
            🎟 Pass Verified: <strong>{ticketPass.ticket_id}</strong> ({ticketPass.name})
          </div>
        )}
      </header>

      {!ticketPass ? (
        <div style={{ maxWidth: '500px', margin: '40px auto', background: '#1e293b', border: '1px solid #334155', padding: '24px', borderRadius: '12px' }}>
          <h3>Get Your Digital Event Access Pass</h3>
          <form onSubmit={handleRegisterTicket}>
            <div style={{ margin: '16px 0' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '6px' }}>Attendee Full Name:</label>
              <input
                type="text"
                required
                value={attendeeName}
                onChange={e => setAttendeeName(e.target.value)}
                placeholder="e.g. Jane Doe"
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              />
            </div>
            <button type="submit" style={{ width: '100%', background: '#38bdf8', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Issue Pass ($49.00 Ticket)
            </button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          <!-- Main Stage Stream View -->
          <div>
            <!-- Room Switcher Tabs -->
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {mockEvent.rooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoom(room)}
                  style={{
                    background: activeRoom.id === room.id ? '#38bdf8' : '#1e293b',
                    color: '#fff',
                    border: '1px solid #334155',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  {room.name}
                </button>
              ))}
            </div>

            <!-- Virtual Video Stream Container -->
            <div style={{ background: '#000', height: '420px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '1px solid #334155', position: 'relative' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>● LIVE BROADCAST</span>
                <h3 style={{ color: '#fff', margin: '0 0 8px' }}>{activeRoom.name}</h3>
                <p style={{ color: '#94a3b8', margin: 0 }}>Speaker: <strong>{activeRoom.speaker}</strong> | Topic: {activeRoom.topic}</p>
              </div>
            </div>
          </div>

          <!-- Q&A and Audience Polls Panel -->
          <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px', display: 'flex', flexDirection: 'column', height: '520px' }}>
            <h3>💬 Live Room Q&A</h3>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '12px' }}>
              {qaList.map(q => (
                <div key={q.id} style={{ background: '#0f172a', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                  <strong style={{ color: '#38bdf8' }}>{q.user}:</strong> {q.text}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Ask speaker a question..."
                value={qaInput}
                onChange={e => setQaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
                style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '8px', borderRadius: '6px' }}
              />
              <button onClick={handleAddQuestion} style={{ background: '#38bdf8', color: '#fff', border: 'none', padding: '0 12px', borderRadius: '6px', cursor: 'pointer' }}>Ask</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
