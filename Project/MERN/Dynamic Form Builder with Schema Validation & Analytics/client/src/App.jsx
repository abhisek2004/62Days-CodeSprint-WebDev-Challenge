import React, { useState } from 'react';

export default function App() {
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'preview' | 'analytics'
  const [formTitle, setFormTitle] = useState('Customer Feedback Survey 2026');
  const [fields, setFields] = useState([
    { id: 1, label: 'Full Name', type: 'text', required: true },
    { id: 2, label: 'Satisfaction Score (1-5)', type: 'number', required: true },
    { id: 3, label: 'Service Category', type: 'select', options: ['Consultation', 'Billing', 'App Support'], required: false }
  ]);
  const [submissions, setSubmissions] = useState([]);
  const [previewValues, setPreviewValues] = useState({});

  const addField = (fieldType) => {
    const newField = {
      id: Date.now(),
      label: `New ${fieldType.toUpperCase()} Field`,
      type: fieldType,
      required: false,
      options: fieldType === 'select' ? ['Option 1', 'Option 2'] : []
    };
    setFields([...fields, newField]);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setSubmissions([
      { id: `SUB-${Date.now()}`, time: new Date().toLocaleTimeString(), data: { ...previewValues } },
      ...submissions
    ]);
    alert('Form submitted successfully!');
    setPreviewValues({});
    setActiveTab('analytics');
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#38bdf8', margin: 0 }}>📝 Dynamic Form Engine & Analytics Dashboard</h2>
        <div>
          <button onClick={() => setActiveTab('builder')} style={{ background: activeTab === 'builder' ? '#38bdf8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}>
            Form Builder
          </button>
          <button onClick={() => setActiveTab('preview')} style={{ background: activeTab === 'preview' ? '#38bdf8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}>
            Live Share Preview
          </button>
          <button onClick={() => setActiveTab('analytics')} style={{ background: activeTab === 'analytics' ? '#38bdf8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
            Analytics ({submissions.length})
          </button>
        </div>
      </header>

      {activeTab === 'builder' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <input
              type="text"
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', fontSize: '1.2rem', padding: '8px', borderRadius: '6px', marginBottom: '20px' }}
            />

            <h3>Schema Fields ({fields.length}):</h3>
            {fields.map((f, i) => (
              <div key={f.id} style={{ background: '#0f172a', border: '1px solid #334155', padding: '12px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{f.label}</strong>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: '10px' }}>Type: {f.type} {f.required && '• Required'}</span>
                </div>
                <button onClick={() => setFields(fields.filter(x => x.id !== f.id))} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                  Delete
                </button>
              </div>
            ))}
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
            <h3>Add Field Component</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => addField('text')} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>+ Short Text Input</button>
              <button onClick={() => addField('number')} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>+ Number / Rating</button>
              <button onClick={() => addField('select')} style={{ background: '#334155', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>+ Dropdown Select</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div style={{ maxWidth: '600px', margin: '0 auto', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
          <h2>{formTitle}</h2>
          <form onSubmit={handleFormSubmit}>
            {fields.map(f => (
              <div key={f.id} style={{ margin: '16px 0' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '6px' }}>
                  {f.label} {f.required && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    required={f.required}
                    onChange={e => setPreviewValues({ ...previewValues, [f.label]: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  >
                    <option value="">Select option...</option>
                    {f.options.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    required={f.required}
                    onChange={e => setPreviewValues({ ...previewValues, [f.label]: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
                  />
                )}
              </div>
            ))}
            <button type="submit" style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}>
              Submit Form Response
            </button>
          </form>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Submissions & Responses ({submissions.length})</h3>
          {submissions.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No submissions collected yet. Submit a response in Live Share Preview.</p>
          ) : (
            submissions.map(s => (
              <div key={s.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ color: '#38bdf8', fontSize: '0.85rem' }}>ID: {s.id} | Timestamp: {s.time}</div>
                <pre style={{ color: '#10b981', margin: '8px 0 0' }}>{JSON.stringify(s.data, null, 2)}</pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
