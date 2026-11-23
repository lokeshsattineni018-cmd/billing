import { useState, useEffect, useRef, useCallback } from 'react';
import { parseVoiceBillingText } from '../utils/voiceBillingParser';

/**
 * Hands-Free Voice Billing Assistant (Admin-Only)
 * Supports real-time speech-to-text in Telugu (te-IN) and English (en-IN)
 */
export default function VoiceBillingAssistant({
  isAdmin,
  onApplyVoiceData,
  currentLang = 'en',
  showToast,
}) {
  // Strict admin-only access check
  if (!isAdmin) return null;

  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState(currentLang === 'te' ? 'te-IN' : 'en-IN');
  const [transcript, setTranscript] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);

  // Sync default voice language when user switches app language
  useEffect(() => {
    setVoiceLang(currentLang === 'te' ? 'te-IN' : 'en-IN');
  }, [currentLang]);

  // Audio tone helper for hands-free audio confirmation
  const playChime = useCallback((freq = 580, duration = 180) => {
    try {
      if (navigator.vibrate) navigator.vibrate(100);
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration / 1000);
      osc.start();
      osc.stop(audioCtx.currentTime + duration / 1000);
      setTimeout(() => audioCtx.close(), duration + 100);
    } catch {
      // AudioContext not allowed before user gesture
    }
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      playChime(440, 100);
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      setTranscript(activeText);

      if (activeText.trim()) {
        const parsed = parseVoiceBillingText(activeText);
        setParsedPreview(parsed);

        if (finalTranscript.trim()) {
          playChime(880, 200);
          if (onApplyVoiceData) {
            onApplyVoiceData(parsed);
          }
          if (showToast) {
            showToast('Voice data applied to invoice ✅', 'success');
          }
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        if (showToast) showToast(`Voice input error: ${event.error}`, 'error');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [onApplyVoiceData, playChime, showToast]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    } else {
      setTranscript('');
      setParsedPreview(null);
      recognitionRef.current.lang = voiceLang;
      try {
        recognitionRef.current.start();
      } catch (err) {
        // If already started, restart
        try {
          recognitionRef.current.stop();
          setTimeout(() => recognitionRef.current.start(), 150);
        } catch (e) {
          if (showToast) showToast('Mic access failed. Check browser permissions.', 'error');
        }
      }
    }
  };

  if (!isSupported) {
    return (
      <div style={{
        background: '#fffbeb',
        border: '1px solid #fef3c7',
        borderRadius: '8px',
        padding: '8px 12px',
        marginBottom: '14px',
        fontSize: '0.8rem',
        color: '#92400e',
      }}>
        🎙️ Voice billing requires Google Chrome, Edge, or Safari with microphone permissions.
      </div>
    );
  }

  return (
    <div
      style={{
        background: isListening ? '#f0fdf4' : '#f8fafc',
        border: isListening ? '2px solid #22c55e' : '1px solid #cbd5e1',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        boxShadow: isListening ? '0 0 16px rgba(34, 197, 94, 0.2)' : '0 2px 4px rgba(0, 0, 0, 0.02)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Big Tap Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            style={{
              background: isListening ? '#dc2626' : '#0b5394',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50px',
              padding: '10px 18px',
              fontSize: '0.9rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              minHeight: '46px',
              boxShadow: isListening
                ? '0 0 12px rgba(220, 38, 38, 0.5)'
                : '0 2px 6px rgba(11, 83, 148, 0.3)',
              transition: 'all 0.2s ease',
            }}
            title={isListening ? 'Click to Stop Listening' : 'Click to Speak Weighment'}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{isListening ? '⏹️' : '🎙️'}</span>
            <span>{isListening ? 'Stop Listening' : 'Voice Billing'}</span>
            {isListening && (
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  animation: 'pulse 1s infinite',
                }}
              />
            )}
          </button>

          {/* Language Switcher Pill for Speech */}
          <div style={{ display: 'flex', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => {
                setVoiceLang('te-IN');
                if (isListening && recognitionRef.current) {
                  recognitionRef.current.lang = 'te-IN';
                }
              }}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: voiceLang === 'te-IN' ? '#0b5394' : '#ffffff',
                color: voiceLang === 'te-IN' ? '#ffffff' : '#475569',
              }}
            >
              తెలుగు (Telugu)
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceLang('en-IN');
                if (isListening && recognitionRef.current) {
                  recognitionRef.current.lang = 'en-IN';
                }
              }}
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: voiceLang === 'en-IN' ? '#0b5394' : '#ffffff',
                color: voiceLang === 'en-IN' ? '#ffffff' : '#475569',
              }}
            >
              English
            </button>
          </div>

          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
            {isListening
              ? voiceLang === 'te-IN'
                ? 'వింటున్నారు... "సూర్య ప్రాన్స్, 40 కౌంట్, 85 కిలోలు, రేటు 420" అని చెప్పండి'
                : 'Listening... say e.g. "Kalyani, 60 count, 120 kg, rate 310"'
              : 'Hands-free voice weighment (Admin)'}
          </span>
        </div>

        {isListening && (
          <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 800 }}>
            ● LIVE RECORDING
          </span>
        )}
      </div>

      {/* Live Transcript & Parsed Data Preview */}
      {(transcript || parsedPreview) && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
          {transcript && (
            <div style={{ fontSize: '0.84rem', color: '#1e293b', marginBottom: '6px' }}>
              🗣️ <em>"{transcript}"</em>
            </div>
          )}

          {parsedPreview && (parsedPreview.partyName || parsedPreview.count || parsedPreview.weight || parsedPreview.rate) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0b5394', textTransform: 'uppercase' }}>
                Extracted:
              </span>
              {parsedPreview.partyName && (
                <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 700, color: '#1e40af' }}>
                  👤 {parsedPreview.partyName}
                </span>
              )}
              {parsedPreview.count && (
                <span style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>
                  🦐 Count: {parsedPreview.count}
                </span>
              )}
              {parsedPreview.weight && (
                <span style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 700, color: '#166534' }}>
                  ⚖️ {parsedPreview.weight} kg
                </span>
              )}
              {parsedPreview.rate && (
                <span style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 700, color: '#5b21b6' }}>
                  💰 ₹{parsedPreview.rate}/kg
                </span>
              )}
              {parsedPreview.iceQty && (
                <span style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '4px', padding: '2px 8px', fontSize: '0.78rem', fontWeight: 700, color: '#155e75' }}>
                  🧊 {parsedPreview.iceQty} Ice
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
