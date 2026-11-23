import { useState, useEffect, useRef, useCallback } from 'react';
import { parseAdvancedVoiceBillingText, VOICE_COMMANDS } from '../utils/voiceBillingParser.js';
import { findBestMatchingCustomer } from '../utils/fuzzyMatch.js';

/**
 * Advanced Hands-Free Voice Billing Suite (Admin-Only)
 * Features:
 * - Multi-item dictation in a single sentence
 * - Continuous Scale Mode (Always-listening for weighing batches)
 * - Text-To-Speech Voice Readback confirmation (Telugu & English)
 * - Intelligent Fuzzy Customer Name Matching
 * - Voice Commands (Save Bill, Add Item, Clear)
 */
export default function VoiceBillingAssistant({
  isAdmin,
  customersList = [],
  onApplyVoiceData,
  onVoiceCommand,
  currentLang = 'en',
  showToast,
}) {
  if (!isAdmin) return null;

  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState(currentLang === 'te' ? 'te-IN' : 'en-IN');
  const [isContinuousScaleMode, setIsContinuousScaleMode] = useState(false);
  const [isVoiceReadbackOn, setIsVoiceReadbackOn] = useState(true);

  const [transcript, setTranscript] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [fuzzyMatchInfo, setFuzzyMatchInfo] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef(null);
  const continuousModeRef = useRef(isContinuousScaleMode);
  continuousModeRef.current = isContinuousScaleMode;

  useEffect(() => {
    setVoiceLang(currentLang === 'te' ? 'te-IN' : 'en-IN');
  }, [currentLang]);

  // Audio tone helper for hands-free audio confirmation
  const playTone = useCallback((freq = 580, duration = 180) => {
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
    } catch {}
  }, []);

  // Text-to-Speech voice confirmation readback
  const speakReadback = useCallback((text, langCode = 'te-IN') => {
    if (!isVoiceReadbackOn || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [isVoiceReadbackOn]);

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
      playTone(440, 100);
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
        const parsed = parseAdvancedVoiceBillingText(activeText);
        setParsedPreview(parsed);

        // Run fuzzy customer matching
        if (parsed.partyName && customersList.length > 0) {
          const matchResult = findBestMatchingCustomer(parsed.partyName, customersList);
          setFuzzyMatchInfo(matchResult);
        } else {
          setFuzzyMatchInfo(null);
        }

        // On complete final phrase:
        if (finalTranscript.trim()) {
          playTone(880, 200);

          // 1. Check Voice Command
          if (parsed.command) {
            if (onVoiceCommand) onVoiceCommand(parsed.command);
            if (showToast) showToast(`Voice Command: ${parsed.command} ⚡`, 'info');
            if (parsed.command === VOICE_COMMANDS.SAVE_BILL) {
              speakReadback(voiceLang === 'te-IN' ? 'బిల్ సేవ్ అవుతోంది' : 'Saving invoice', voiceLang);
            }
            return;
          }

          // 2. Apply structured items & customer
          if (onApplyVoiceData) {
            onApplyVoiceData(parsed);
          }

          if (showToast) {
            const itemCount = parsed.items?.length || 0;
            showToast(
              `Voice: ${parsed.partyName || 'Invoice'} • ${itemCount} ${itemCount === 1 ? 'item' : 'items'} auto-filled ✅`,
              'success'
            );
          }

          // 3. Audio Voice Readback
          if (parsed.items && parsed.items.length > 0) {
            const first = parsed.items[0];
            const name = parsed.partyName || '';
            const readbackText =
              voiceLang === 'te-IN'
                ? `${name ? name + ' ' : ''}${first.count ? first.count + ' కౌంట్ ' : ''}${first.weight ? first.weight + ' కేజీలు ' : ''}${first.rate ? 'రేటు ' + first.rate : ''} జోడించబడింది.`
                : `${name ? name + ': ' : ''}${first.count ? first.count + ' count, ' : ''}${first.weight ? first.weight + ' kg at ' : ''}${first.rate ? first.rate + ' rupees' : ''} added.`;
            speakReadback(readbackText, voiceLang);
          }
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        if (showToast) showToast(`Mic error: ${event.error}`, 'error');
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Continuous Scale Mode: restart automatically for the next crate/tub
      if (continuousModeRef.current && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch {}
        }, 250);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.abort();
      } catch {}
    };
  }, [customersList, onApplyVoiceData, onVoiceCommand, playTone, showToast, speakReadback, voiceLang]);

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
      setFuzzyMatchInfo(null);
      recognitionRef.current.lang = voiceLang;
      try {
        recognitionRef.current.start();
      } catch {
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
        border: isListening ? '2px solid #16a34a' : '1px solid #cbd5e1',
        borderRadius: '14px',
        padding: '14px 18px',
        marginBottom: '18px',
        boxShadow: isListening ? '0 0 20px rgba(22, 163, 74, 0.22)' : '0 2px 6px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Big Master Mic Button */}
          <button
            type="button"
            onClick={toggleListening}
            style={{
              background: isListening ? '#dc2626' : '#0b5394',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50px',
              padding: '10px 20px',
              fontSize: '0.92rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              minHeight: '48px',
              boxShadow: isListening
                ? '0 0 14px rgba(220, 38, 38, 0.55)'
                : '0 2px 8px rgba(11, 83, 148, 0.35)',
              transition: 'all 0.2s ease',
            }}
            title={isListening ? 'Click to Stop Listening' : 'Click to Speak Weighment'}
          >
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{isListening ? '⏹️' : '🎙️'}</span>
            <span>{isListening ? 'Stop' : 'Voice Billing'}</span>
            {isListening && (
              <span
                style={{
                  display: 'inline-block',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  animation: 'pulse 1s infinite',
                }}
              />
            )}
          </button>

          {/* Language Switcher */}
          <div style={{ display: 'flex', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => {
                setVoiceLang('te-IN');
                if (isListening && recognitionRef.current) recognitionRef.current.lang = 'te-IN';
              }}
              style={{
                padding: '7px 12px',
                fontSize: '0.8rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: voiceLang === 'te-IN' ? '#0b5394' : '#ffffff',
                color: voiceLang === 'te-IN' ? '#ffffff' : '#475569',
              }}
            >
              తెలుగు
            </button>
            <button
              type="button"
              onClick={() => {
                setVoiceLang('en-IN');
                if (isListening && recognitionRef.current) recognitionRef.current.lang = 'en-IN';
              }}
              style={{
                padding: '7px 12px',
                fontSize: '0.8rem',
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

          {/* Continuous Scale Mode Switch */}
          <button
            type="button"
            onClick={() => {
              const next = !isContinuousScaleMode;
              setIsContinuousScaleMode(next);
              if (showToast) showToast(next ? 'Scale Mode Active: Mic stays open' : 'Scale Mode Off', 'info');
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: isContinuousScaleMode ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
              background: isContinuousScaleMode ? '#dcfce7' : '#ffffff',
              color: isContinuousScaleMode ? '#15803d' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Keeps the microphone active continuously without needing to tap after each tub"
          >
            <span>⚖️ Continuous Scale Mode:</span>
            <strong>{isContinuousScaleMode ? 'ON' : 'OFF'}</strong>
          </button>

          {/* Voice Readback Audio Toggle */}
          <button
            type="button"
            onClick={() => setIsVoiceReadbackOn(!isVoiceReadbackOn)}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 800,
              borderRadius: '8px',
              border: isVoiceReadbackOn ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
              background: isVoiceReadbackOn ? '#eff6ff' : '#ffffff',
              color: isVoiceReadbackOn ? '#1d4ed8' : '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Speaks back the weighed prawn details as audio confirmation"
          >
            <span>🔊 Readback:</span>
            <strong>{isVoiceReadbackOn ? 'ON' : 'OFF'}</strong>
          </button>
        </div>

        {/* Live Audio Status */}
        {isListening && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.76rem', color: '#16a34a', fontWeight: 900, letterSpacing: '0.5px' }}>
              ● LIVE SCALING
            </span>
          </div>
        )}
      </div>

      {/* Live Transcript & Real-Time Extracted Entities Card */}
      {(transcript || parsedPreview) && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
          {transcript && (
            <div style={{ fontSize: '0.86rem', color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '1rem' }}>🗣️</span>
              <em>"{transcript}"</em>
            </div>
          )}

          {/* Voice Command Confirmation */}
          {parsedPreview?.command && (
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: '#92400e',
              marginBottom: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              ⚡ Action Command Recognized: <strong>{parsedPreview.command}</strong>
            </div>
          )}

          {/* Extracted Items & Customer Details */}
          {parsedPreview && (parsedPreview.partyName || (parsedPreview.items && parsedPreview.items.length > 0)) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#0b5394', textTransform: 'uppercase' }}>
                Extracted:
              </span>

              {parsedPreview.partyName && (
                <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 10px', fontSize: '0.82rem', fontWeight: 700, color: '#1e40af' }}>
                  👤 {parsedPreview.partyName}
                </span>
              )}

              {/* Fuzzy Customer Match Badge */}
              {fuzzyMatchInfo?.match && (
                <span style={{
                  background: fuzzyMatchInfo.isHighConfidence ? '#f0fdf4' : '#fffbeb',
                  border: `1px solid ${fuzzyMatchInfo.isHighConfidence ? '#bbf7d0' : '#fde68a'}`,
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  color: fuzzyMatchInfo.isHighConfidence ? '#15803d' : '#b45309',
                }}>
                  🎯 Matched: <strong>{fuzzyMatchInfo.match.companyName}</strong> ({Math.round(fuzzyMatchInfo.score * 100)}%)
                </span>
              )}

              {/* Multi-Item Badges */}
              {parsedPreview.items?.map((it, idx) => (
                <span
                  key={idx}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: '#334155',
                  }}
                >
                  Item #{idx + 1}: {it.count ? `🦐 ${it.count} Count` : ''} {it.weight ? `• ⚖️ ${it.weight} kg` : ''} {it.rate ? `• 💰 ₹${it.rate}/kg` : ''}
                </span>
              ))}

              {parsedPreview.iceQty && (
                <span style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: '6px', padding: '3px 8px', fontSize: '0.8rem', fontWeight: 700, color: '#155e75' }}>
                  🧊 {parsedPreview.iceQty} Ice
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Helper guide with examples */}
      <div style={{ marginTop: '10px', fontSize: '0.72rem', color: '#64748b' }}>
        💡 <strong>Try speaking:</strong> <em>"Surya Prawns, 40 count 85 kg rate 420 and 60 count 110 kg rate 320, 2 ice"</em> | Voice commands: <em>"Save Bill"</em>, <em>"Add Item"</em>, <em>"Clear Bill"</em>
      </div>
    </div>
  );
}
