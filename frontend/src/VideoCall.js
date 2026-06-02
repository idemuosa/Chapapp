import React, { useEffect, useRef, useState } from 'react';

function VideoCall({ socket, username, initialTargetId }) {
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, in-call
  const [remoteUserId, setRemoteUserId] = useState(initialTargetId || null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();

  const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  };

  useEffect(() => {
    if (!socket) return;

    socket.on('call-made', async (data) => {
      if (window.confirm(`${data.username} is calling you. Accept?`)) {
        setRemoteUserId(data.from);
        setCallStatus('in-call');

        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection(config);
        stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

        peerConnection.current.ontrack = ({ streams: [remoteStream] }) => {
          remoteVideoRef.current.srcObject = remoteStream;
        };

        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('ice-candidate', { to: data.from, candidate: event.candidate });
          }
        };

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);

        socket.emit('make-answer', { to: data.from, answer });
      }
    });

    socket.on('answer-made', async (data) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
      setCallStatus('in-call');
    });

    socket.on('ice-candidate', (data) => {
      if (peerConnection.current) {
        peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    // If we have an initial target, start the call automatically
    if (initialTargetId && callStatus === 'idle') {
      startCall(initialTargetId);
    }

    return () => {
      socket.off('call-made');
      socket.off('answer-made');
      socket.off('ice-candidate');
    };
  }, [socket, initialTargetId]);

  const startCall = async (targetId) => {
    setRemoteUserId(targetId);
    setCallStatus('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;

      peerConnection.current = new RTCPeerConnection(config);
      stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

      peerConnection.current.ontrack = ({ streams: [remoteStream] }) => {
        remoteVideoRef.current.srcObject = remoteStream;
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice-candidate', { to: targetId, candidate: event.candidate });
        }
      };

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket.emit('call-user', { to: targetId, offer });
    } catch (err) {
      console.error('Error starting call:', err);
      setCallStatus('idle');
    }
  };

  const hangUp = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCallStatus('idle');
    setRemoteUserId(null);
  };

  return (
    <div className="video-call-container">
      <div className="videos">
        <div className="video-wrapper">
          <label>You</label>
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
        </div>
        <div className="video-wrapper">
          <label>Remote</label>
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
        </div>
      </div>

      <div className="call-controls">
        {callStatus === 'idle' ? (
          <div>
            <input type="text" placeholder="Enter User ID to call" id="targetId" />
            <button onClick={() => startCall(document.getElementById('targetId').value)}>
              Call
            </button>
          </div>
        ) : (
          <button onClick={hangUp} className="hangup-btn">Hang Up</button>
        )}
        <p>Status: {callStatus}</p>
        {remoteUserId && <p>Talking to User ID: {remoteUserId}</p>}
      </div>
    </div>
  );
}

export default VideoCall;
