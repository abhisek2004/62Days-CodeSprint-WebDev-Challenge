/**
 * NetSniff Studio - Client-Side Packet Sniffer & Protocol Frame Analyzer
 * Core Architecture & Application Engine
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. STATE & STORAGE
    // =========================================================================
    const state = {
        isCapturing: true,
        packets: [],
        filteredPackets: [],
        selectedPacketId: null,
        activeProtocolFilter: 'ALL',
        searchQuery: '',
        autoScroll: true,
        packetCounter: 0,
        captureStartTime: Date.now(),
        fetchInterceptorActive: true,
        stats: {
            totalCount: 0,
            bytesCaptured: 0,
            lastSecondPackets: 0,
            lastSecondBytes: 0,
            pps: 0,
            bandwidth: 0
        },
        sortColumn: 'id',
        sortAscending: true,
        resizing: null
    };

    // Original fetch reference for monkey-patching
    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    // =========================================================================
    // 2. RAW PACKET GENERATOR & PROTOCOL SYNTHESIZER
    // =========================================================================

    /**
     * Converts an IP string like "192.168.1.45" to 4 bytes array
     */
    function ipToBytes(ipStr) {
        return ipStr.split('.').map(num => parseInt(num, 10) & 0xFF);
    }

    /**
     * Converts a MAC string like "00:1a:2b:3c:4d:5e" to 6 bytes array
     */
    function macToBytes(macStr) {
        return macStr.split(':').map(hex => parseInt(hex, 16) & 0xFF);
    }

    /**
     * Converts a string to UTF-8 Uint8Array
     */
    function stringToBytes(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
    }

    /**
     * Creates a raw frame packet Uint8Array and detailed layer tree mappings
     */
    function buildPacketFrame({ srcIp, dstIp, srcPort, dstPort, protocol, info, payloadText, extraFlags }) {
        state.packetCounter++;
        const packetId = state.packetCounter;
        const relativeTime = ((Date.now() - state.captureStartTime) / 1000).toFixed(6);

        const srcMacStr = `00:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:4d:5e`;
        const dstMacStr = `50:6b:8d:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:${Math.floor(Math.random()*256).toString(16).padStart(2,'0')}:11`;

        const srcMac = macToBytes(srcMacStr);
        const dstMac = macToBytes(dstMacStr);
        const srcIpArr = ipToBytes(srcIp);
        const dstIpArr = ipToBytes(dstIp);

        const payloadBytes = payloadText ? stringToBytes(payloadText) : new Uint8Array(0);

        // Header lengths: Ethernet II (14), IPv4 (20), TCP (20) or UDP (8)
        const ethLen = 14;
        const ipLen = 20;
        const isUdp = (protocol === 'UDP' || protocol === 'DNS');
        const transportLen = isUdp ? 8 : 20;

        const totalLength = ethLen + ipLen + transportLen + payloadBytes.length;
        const rawData = new Uint8Array(totalLength);

        // --- Layer 1 & 2: Ethernet II ---
        rawData.set(dstMac, 0); // 0-5 Dst MAC
        rawData.set(srcMac, 6); // 6-11 Src MAC
        rawData[12] = 0x08; rawData[13] = 0x00; // Type IPv4

        // --- Layer 3: IPv4 ---
        const ipOffset = 14;
        rawData[ipOffset + 0] = 0x45; // Version 4, IHL 5 (20 bytes)
        rawData[ipOffset + 1] = 0x00; // TOS
        const ipTotalLen = ipLen + transportLen + payloadBytes.length;
        rawData[ipOffset + 2] = (ipTotalLen >> 8) & 0xFF;
        rawData[ipOffset + 3] = ipTotalLen & 0xFF;
        rawData[ipOffset + 4] = Math.floor(Math.random() * 256); // ID hi
        rawData[ipOffset + 5] = Math.floor(Math.random() * 256); // ID lo
        rawData[ipOffset + 6] = 0x40; rawData[ipOffset + 7] = 0x00; // Flags: Don't fragment
        rawData[ipOffset + 8] = 64; // TTL
        rawData[ipOffset + 9] = isUdp ? 17 : 6; // Protocol: 6 (TCP), 17 (UDP)
        rawData[ipOffset + 10] = 0x1a; rawData[ipOffset + 11] = 0x2b; // Checksum
        rawData.set(srcIpArr, ipOffset + 12);
        rawData.set(dstIpArr, ipOffset + 16);

        // --- Layer 4: TCP or UDP ---
        const transOffset = ipOffset + ipLen;
        if (isUdp) {
            rawData[transOffset + 0] = (srcPort >> 8) & 0xFF;
            rawData[transOffset + 1] = srcPort & 0xFF;
            rawData[transOffset + 2] = (dstPort >> 8) & 0xFF;
            rawData[transOffset + 3] = dstPort & 0xFF;
            const udpLen = 8 + payloadBytes.length;
            rawData[transOffset + 4] = (udpLen >> 8) & 0xFF;
            rawData[transOffset + 5] = udpLen & 0xFF;
            rawData[transOffset + 6] = 0x00; rawData[transOffset + 7] = 0x00;
        } else {
            // TCP
            rawData[transOffset + 0] = (srcPort >> 8) & 0xFF;
            rawData[transOffset + 1] = srcPort & 0xFF;
            rawData[transOffset + 2] = (dstPort >> 8) & 0xFF;
            rawData[transOffset + 3] = dstPort & 0xFF;
            const seqNum = Math.floor(Math.random() * 1000000);
            rawData[transOffset + 4] = (seqNum >> 24) & 0xFF;
            rawData[transOffset + 5] = (seqNum >> 16) & 0xFF;
            rawData[transOffset + 6] = (seqNum >> 8) & 0xFF;
            rawData[transOffset + 7] = seqNum & 0xFF;
            const ackNum = seqNum + payloadBytes.length + 1;
            rawData[transOffset + 8] = (ackNum >> 24) & 0xFF;
            rawData[transOffset + 9] = (ackNum >> 16) & 0xFF;
            rawData[transOffset + 10] = (ackNum >> 8) & 0xFF;
            rawData[transOffset + 11] = ackNum & 0xFF;
            rawData[transOffset + 12] = 0x50; // Header length 20 bytes (5 x 4)
            rawData[transOffset + 13] = extraFlags || (payloadBytes.length > 0 ? 0x18 : 0x10); // PSH, ACK
            rawData[transOffset + 14] = 0xfa; rawData[transOffset + 15] = 0xf0; // Window Size
            rawData[transOffset + 16] = 0x12; rawData[transOffset + 17] = 0x34; // Checksum
            rawData[transOffset + 18] = 0x00; rawData[transOffset + 19] = 0x00;
        }

        // --- Layer 5: Payload ---
        const payloadOffset = transOffset + transportLen;
        if (payloadBytes.length > 0) {
            rawData.set(payloadBytes, payloadOffset);
        }

        // Build Layer Tree Structure with precise Offsets and Lengths
        const layers = [
            {
                name: `Frame ${packetId}: ${totalLength} bytes on wire (${totalLength * 8} bits)`,
                offset: 0,
                len: totalLength,
                children: [
                    { name: `Arrival Time: ${new Date().toISOString()}`, offset: 0, len: totalLength },
                    { name: `Frame Length: ${totalLength} bytes`, offset: 0, len: totalLength },
                    { name: `Capture Length: ${totalLength} bytes`, offset: 0, len: totalLength }
                ]
            },
            {
                name: `Ethernet II, Src: ${srcMacStr}, Dst: ${dstMacStr}`,
                offset: 0,
                len: 14,
                children: [
                    { name: `Destination MAC: ${dstMacStr}`, offset: 0, len: 6 },
                    { name: `Source MAC: ${srcMacStr}`, offset: 6, len: 6 },
                    { name: `Type: IPv4 (0x0800)`, offset: 12, len: 2 }
                ]
            },
            {
                name: `Internet Protocol Version 4, Src: ${srcIp}, Dst: ${dstIp}`,
                offset: ipOffset,
                len: ipLen,
                children: [
                    { name: `Version: 4`, offset: ipOffset + 0, len: 1 },
                    { name: `Header Length: 20 bytes (5)`, offset: ipOffset + 0, len: 1 },
                    { name: `Differentiated Services Field: 0x00`, offset: ipOffset + 1, len: 1 },
                    { name: `Total Length: ${ipTotalLen} bytes`, offset: ipOffset + 2, len: 2 },
                    { name: `Identification: 0x${((rawData[ipOffset+4]<<8)+rawData[ipOffset+5]).toString(16).padStart(4,'0')}`, offset: ipOffset + 4, len: 2 },
                    { name: `Flags: 0x4000, Don't fragment`, offset: ipOffset + 6, len: 2 },
                    { name: `Time to Live (TTL): 64`, offset: ipOffset + 8, len: 1 },
                    { name: `Protocol: ${isUdp ? 'UDP (17)' : 'TCP (6)'}`, offset: ipOffset + 9, len: 1 },
                    { name: `Header Checksum: 0x1a2b [verified]`, offset: ipOffset + 10, len: 2 },
                    { name: `Source IP Address: ${srcIp}`, offset: ipOffset + 12, len: 4 },
                    { name: `Destination IP Address: ${dstIp}`, offset: ipOffset + 16, len: 4 }
                ]
            }
        ];

        // Transport Layer Tree
        if (isUdp) {
            layers.push({
                name: `User Datagram Protocol, Src Port: ${srcPort}, Dst Port: ${dstPort}`,
                offset: transOffset,
                len: 8,
                children: [
                    { name: `Source Port: ${srcPort}`, offset: transOffset + 0, len: 2 },
                    { name: `Destination Port: ${dstPort}`, offset: transOffset + 2, len: 2 },
                    { name: `Length: ${8 + payloadBytes.length}`, offset: transOffset + 4, len: 2 },
                    { name: `Checksum: 0x0000 [unverified]`, offset: transOffset + 6, len: 2 }
                ]
            });
        } else {
            const flagByte = rawData[transOffset + 13];
            const flagNames = [];
            if (flagByte & 0x02) flagNames.push('SYN');
            if (flagByte & 0x10) flagNames.push('ACK');
            if (flagByte & 0x08) flagNames.push('PSH');
            if (flagByte & 0x01) flagNames.push('FIN');
            if (flagByte & 0x04) flagNames.push('RST');

            layers.push({
                name: `Transmission Control Protocol, Src Port: ${srcPort}, Dst Port: ${dstPort}, Flags: [${flagNames.join(', ')}]`,
                offset: transOffset,
                len: 20,
                children: [
                    { name: `Source Port: ${srcPort}`, offset: transOffset + 0, len: 2 },
                    { name: `Destination Port: ${dstPort}`, offset: transOffset + 2, len: 2 },
                    { name: `Sequence Number: ${((rawData[transOffset+4]<<24)|(rawData[transOffset+5]<<16)|(rawData[transOffset+6]<<8)|rawData[transOffset+7]) >>> 0}`, offset: transOffset + 4, len: 4 },
                    { name: `Acknowledgment Number: ${((rawData[transOffset+8]<<24)|(rawData[transOffset+9]<<16)|(rawData[transOffset+10]<<8)|rawData[transOffset+11]) >>> 0}`, offset: transOffset + 8, len: 4 },
                    { name: `Header Length: 20 bytes (5)`, offset: transOffset + 12, len: 1 },
                    { name: `TCP Flags: 0x${flagByte.toString(16).padStart(2,'0')} [${flagNames.join(', ')}]`, offset: transOffset + 13, len: 1 },
                    { name: `Window Size: 64240`, offset: transOffset + 14, len: 2 },
                    { name: `Checksum: 0x1234 [calculated]`, offset: transOffset + 16, len: 2 }
                ]
            });
        }

        // Application Layer Tree
        if (payloadBytes.length > 0) {
            let appLayerName = `Data Payload (${payloadBytes.length} bytes)`;
            const appChildren = [
                { name: `Payload Length: ${payloadBytes.length} bytes`, offset: payloadOffset, len: payloadBytes.length }
            ];

            if (protocol === 'HTTP' || protocol === 'HTTPS') {
                appLayerName = `Hypertext Transfer Protocol (${payloadText.split('\r\n')[0] || 'Payload'})`;
                const lines = payloadText.split('\r\n');
                lines.forEach((line, idx) => {
                    if (line.trim().length > 0) {
                        appChildren.push({ name: line, offset: payloadOffset, len: payloadBytes.length });
                    }
                });
            } else if (protocol === 'DNS') {
                appLayerName = `Domain Name System (${info})`;
                appChildren.push({ name: `Transaction ID: 0x${Math.floor(Math.random()*65535).toString(16)}`, offset: payloadOffset, len: 2 });
                appChildren.push({ name: `Query Name: ${payloadText}`, offset: payloadOffset, len: payloadBytes.length });
            } else if (protocol === 'WS') {
                appLayerName = `WebSocket Framing Protocol (${info})`;
                appChildren.push({ name: `Opcode: Text Frame (0x1)`, offset: payloadOffset, len: 1 });
                appChildren.push({ name: `Payload Data: "${payloadText}"`, offset: payloadOffset + 2, len: payloadBytes.length });
            }

            layers.push({
                name: appLayerName,
                offset: payloadOffset,
                len: payloadBytes.length,
                children: appChildren
            });
        }

        return {
            id: packetId,
            time: relativeTime,
            srcIp: `${srcIp}:${srcPort}`,
            dstIp: `${dstIp}:${dstPort}`,
            protocol,
            len: totalLength,
            info,
            rawData,
            layers,
            payloadText
        };
    }

    // =========================================================================
    // 3. SAMPLE TRAFFIC GENERATOR ENGINE
    // =========================================================================
    const generatorTemplates = {
        httpGet: () => [
            { srcIp: '192.168.1.45', dstIp: '104.21.32.8', srcPort: 54321, dstPort: 80, protocol: 'HTTP', info: 'GET /api/v1/patients HTTP/1.1', payloadText: 'GET /api/v1/patients HTTP/1.1\r\nHost: api.doctorapp.internal\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: application/json\r\n\r\n' },
            { srcIp: '104.21.32.8', dstIp: '192.168.1.45', srcPort: 80, dstPort: 54321, protocol: 'HTTP', info: 'HTTP/1.1 200 OK (application/json)', payloadText: 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 78\r\n\r\n{"status":"success","patients":[{"id":101,"name":"Sarah Connor","age":34}]}' }
        ],
        httpPost: () => [
            { srcIp: '192.168.1.45', dstIp: '104.21.32.8', srcPort: 54322, dstPort: 443, protocol: 'HTTPS', info: 'POST /api/v1/auth/login HTTP/1.1', payloadText: 'POST /api/v1/auth/login HTTP/1.1\r\nHost: api.doctorapp.internal\r\nContent-Type: application/json\r\n\r\n{"username":"dr_smith","password":"●●●●●●●●"}' },
            { srcIp: '104.21.32.8', dstIp: '192.168.1.45', srcPort: 443, dstPort: 54322, protocol: 'HTTPS', info: 'HTTP/1.1 200 OK (Bearer JWT Token)', payloadText: 'HTTP/1.1 200 OK\r\nSet-Cookie: session=eyJhbGciOiJIUzI1NiI...\r\n\r\n{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"}' }
        ],
        wsChat: () => [
            { srcIp: '192.168.1.45', dstIp: '172.67.182.12', srcPort: 55100, dstPort: 8080, protocol: 'WS', info: 'WebSocket Handshake Request (Upgrade: websocket)', payloadText: 'GET /chat/v1 HTTP/1.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n' },
            { srcIp: '172.67.182.12', dstIp: '192.168.1.45', srcPort: 8080, dstPort: 55100, protocol: 'WS', info: 'WebSocket 101 Switching Protocols', payloadText: 'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n' },
            { srcIp: '192.168.1.45', dstIp: '172.67.182.12', srcPort: 55100, dstPort: 8080, protocol: 'WS', info: 'WebSocket Text Frame [PING]', payloadText: '{"type":"ping","timestamp":1722387600}' },
            { srcIp: '172.67.182.12', dstIp: '192.168.1.45', srcPort: 8080, dstPort: 55100, protocol: 'WS', info: 'WebSocket Text Frame [PONG]', payloadText: '{"type":"pong","latency_ms":12}' }
        ],
        dnsQuery: () => [
            { srcIp: '192.168.1.45', dstIp: '1.1.1.1', srcPort: 61234, dstPort: 53, protocol: 'DNS', info: 'Standard query 0x1a2b A api.doctorapp.internal', payloadText: 'api.doctorapp.internal' },
            { srcIp: '1.1.1.1', dstIp: '192.168.1.45', srcPort: 53, dstPort: 61234, protocol: 'DNS', info: 'Standard query response 0x1a2b A 104.21.32.8', payloadText: 'api.doctorapp.internal -> 104.21.32.8' }
        ],
        tlsHandshake: () => [
            { srcIp: '192.168.1.45', dstIp: '142.250.190.46', srcPort: 58900, dstPort: 443, protocol: 'HTTPS', info: 'Client Hello (TLS 1.3, SNI google.com)', payloadText: '\x16\x03\x01\x00\xfc\x01\x00\x00\xf8\x03\x03ClientHello...SNI=google.com' },
            { srcIp: '142.250.190.46', dstIp: '192.168.1.45', srcPort: 443, dstPort: 58900, protocol: 'HTTPS', info: 'Server Hello, Change Cipher Spec, Encrypted Extensions', payloadText: '\x16\x03\x03\x00\x5a\x02\x00\x00\x56\x03\x03ServerHello...Cipher=TLS_AES_256_GCM_SHA384' }
        ],
        tcpHandshake: () => [
            { srcIp: '192.168.1.45', dstIp: '93.184.216.34', srcPort: 51200, dstPort: 80, protocol: 'TCP', info: '51200 -> 80 [SYN] Seq=0 Win=64240 Len=0', payloadText: '', extraFlags: 0x02 },
            { srcIp: '93.184.216.34', dstIp: '192.168.1.45', srcPort: 80, dstPort: 51200, protocol: 'TCP', info: '80 -> 51200 [SYN, ACK] Seq=0 Ack=1 Win=65535 Len=0', payloadText: '', extraFlags: 0x12 },
            { srcIp: '192.168.1.45', dstIp: '93.184.216.34', srcPort: 51200, dstPort: 80, protocol: 'TCP', info: '51200 -> 80 [ACK] Seq=1 Ack=1 Win=64240 Len=0', payloadText: '', extraFlags: 0x10 },
            { srcIp: '93.184.216.34', dstIp: '192.168.1.45', srcPort: 80, dstPort: 51200, protocol: 'TCP', info: '80 -> 51200 [RST, ACK] Seq=1 Ack=1 Len=0', payloadText: '', extraFlags: 0x14 }
        ]
    };

    /**
     * Ingests generated packets into active packet list
     */
    function injectPackets(packetDataArray) {
        packetDataArray.forEach(data => {
            const pkt = buildPacketFrame(data);
            state.packets.push(pkt);
            state.stats.totalCount++;
            state.stats.bytesCaptured += pkt.len;
            state.stats.lastSecondPackets++;
            state.stats.lastSecondBytes += pkt.len;
        });

        applyFilterAndRender();
    }

    // Initialize with a rich initial capture buffer
    function seedInitialPackets() {
        injectPackets(generatorTemplates.dnsQuery());
        injectPackets(generatorTemplates.httpGet());
        injectPackets(generatorTemplates.wsChat());
        injectPackets(generatorTemplates.tlsHandshake());
    }

    // Automatic background packet generator (simulate live traffic)
    setInterval(() => {
        if (!state.isCapturing) return;

        // 30% chance every 1.5 seconds to capture background packet
        if (Math.random() < 0.4) {
            const types = ['httpGet', 'httpPost', 'wsChat', 'dnsQuery', 'tcpHandshake'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            const templatePkts = generatorTemplates[randomType]();
            injectPackets([templatePkts[Math.floor(Math.random() * templatePkts.length)]]);
        }
    }, 1500);

    // Bandwidth & PPS Stats Calculation Timer
    setInterval(() => {
        state.stats.pps = state.stats.lastSecondPackets;
        state.stats.bandwidth = (state.stats.lastSecondBytes / 1024).toFixed(1);
        state.stats.lastSecondPackets = 0;
        state.stats.lastSecondBytes = 0;

        document.getElementById('stat-total-packets').textContent = state.stats.totalCount;
        document.getElementById('stat-pps').textContent = `${state.stats.pps} /s`;
        document.getElementById('stat-bandwidth').textContent = `${state.stats.bandwidth} KB/s`;
    }, 1000);

    // =========================================================================
    // 4. BROWSER FETCH & XHR INTERCEPTOR SIMULATION
    // =========================================================================
    function setupFetchInterceptor() {
        window.fetch = async function(...args) {
            if (state.fetchInterceptorActive) {
                const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'https://api.internal');
                const method = args[1]?.method || 'GET';
                
                // Inject fake client HTTP request packet
                injectPackets([{
                    srcIp: '127.0.0.1',
                    dstIp: '192.168.1.1',
                    srcPort: 54000 + Math.floor(Math.random() * 1000),
                    dstPort: url.startsWith('https') ? 443 : 80,
                    protocol: url.startsWith('https') ? 'HTTPS' : 'HTTP',
                    info: `${method} ${url} (Intercepted Fetch)`,
                    payloadText: `${method} ${url} HTTP/1.1\r\nHost: ${window.location.host}\r\nUser-Agent: NetSniff-Interceptor/2.5\r\n\r\n`
                }]);
            }

            try {
                const response = await originalFetch.apply(this, args);
                if (state.fetchInterceptorActive) {
                    const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || 'https://api.internal');
                    injectPackets([{
                        srcIp: '192.168.1.1',
                        dstIp: '127.0.0.1',
                        srcPort: url.startsWith('https') ? 443 : 80,
                        dstPort: 54000,
                        protocol: url.startsWith('https') ? 'HTTPS' : 'HTTP',
                        info: `HTTP/1.1 ${response.status} ${response.statusText}`,
                        payloadText: `HTTP/1.1 ${response.status} ${response.statusText}\r\nContent-Type: ${response.headers.get('content-type') || 'text/plain'}\r\n\r\n[Body Intercepted]`
                    }]);
                }
                return response;
            } catch (err) {
                throw err;
            }
        };
    }

    // =========================================================================
    // 5. RENDERING & DISPLAY CONTROLLER
    // =========================================================================

    /**
     * Applies Protocol Filter & Wireshark Filter Input to render table
     */
    function applyFilterAndRender() {
        const query = state.searchQuery.toLowerCase().trim();
        const protoFilter = state.activeProtocolFilter;

        state.filteredPackets = state.packets.filter(pkt => {
            // Protocol Filter Badge
            if (protoFilter !== 'ALL' && pkt.protocol !== protoFilter) {
                // HTTPS can match HTTPS or TLS
                if (protoFilter === 'HTTPS' && (pkt.protocol === 'HTTPS' || pkt.protocol === 'TLS')) {
                    // pass
                } else {
                    return false;
                }
            }

            // Search Query Filter
            if (query) {
                if (query.startsWith('ip.addr == ') || query.startsWith('ip.src == ') || query.startsWith('ip.dst == ')) {
                    const targetIp = query.split('==')[1].trim();
                    return pkt.srcIp.includes(targetIp) || pkt.dstIp.includes(targetIp);
                } else if (query.startsWith('port == ')) {
                    const targetPort = query.split('==')[1].trim();
                    return pkt.srcIp.includes(`:${targetPort}`) || pkt.dstIp.includes(`:${targetPort}`);
                }

                // General substring search
                const searchHaystack = `${pkt.id} ${pkt.time} ${pkt.srcIp} ${pkt.dstIp} ${pkt.protocol} ${pkt.info} ${pkt.payloadText || ''}`.toLowerCase();
                return searchHaystack.includes(query);
            }

            return true;
        });

        renderPacketTable();
    }

    /**
     * Renders table rows in #packet-table-body
     */
    function renderPacketTable() {
        const tbody = document.getElementById('packet-table-body');
        const emptyState = document.getElementById('empty-state');
        const displayCountInfo = document.getElementById('display-count-info');

        displayCountInfo.textContent = `Displaying: ${state.filteredPackets.length} / ${state.packets.length} packets (${state.packets.length ? Math.round(state.filteredPackets.length/state.packets.length*100) : 100}%)`;

        if (state.filteredPackets.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        } else {
            emptyState.style.display = 'none';
        }

        const fragment = document.createDocumentFragment();

        state.filteredPackets.forEach(pkt => {
            const tr = document.createElement('tr');
            tr.className = `packet-row ${pkt.id === state.selectedPacketId ? 'selected' : ''}`;
            tr.dataset.id = pkt.id;
            tr.dataset.protocol = pkt.protocol;

            tr.innerHTML = `
                <td class="col-no">${pkt.id}</td>
                <td class="col-time">${pkt.time}</td>
                <td class="col-src">${pkt.srcIp}</td>
                <td class="col-dst">${pkt.dstIp}</td>
                <td class="col-proto"><span class="proto-badge badge-${pkt.protocol.toLowerCase()}">${pkt.protocol}</span></td>
                <td class="col-len">${pkt.len}</td>
                <td class="col-info" title="${escapeHtml(pkt.info)}">${escapeHtml(pkt.info)}</td>
            `;

            tr.addEventListener('click', () => selectPacket(pkt.id));
            fragment.appendChild(tr);
        });

        tbody.innerHTML = '';
        tbody.appendChild(fragment);

        // Auto-scroll table to bottom if enabled
        if (state.autoScroll && state.isCapturing) {
            const scrollContainer = document.querySelector('.table-scroll-container');
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }

    /**
     * Selects a packet row and populates Details Tree and Hex Viewer
     */
    function selectPacket(pktId) {
        state.selectedPacketId = pktId;
        const pkt = state.packets.find(p => p.id === pktId);

        // Enable Follow Stream button
        const btnFollow = document.getElementById('btn-follow-stream');
        btnFollow.classList.remove('disabled');
        btnFollow.removeAttribute('disabled');

        // Update selected row style
        document.querySelectorAll('.packet-row').forEach(row => {
            if (parseInt(row.dataset.id, 10) === pktId) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });

        // Summary bar
        document.getElementById('selected-packet-summary').textContent = `Packet #${pkt.id} [${pkt.protocol}] (${pkt.len} bytes)`;

        // Render Details Tree & Hex Dump
        renderDetailsTree(pkt);
        renderHexViewer(pkt);
    }

    /**
     * Renders hierarchical collapsible tree view in #tree-container
     */
    function renderDetailsTree(pkt) {
        const treeContainer = document.getElementById('tree-container');
        treeContainer.innerHTML = '';

        pkt.layers.forEach((layer, layerIdx) => {
            const nodeEl = document.createElement('div');
            nodeEl.className = 'tree-node expanded';

            const headerEl = document.createElement('div');
            headerEl.className = 'node-header';
            headerEl.dataset.offset = layer.offset;
            headerEl.dataset.len = layer.len;
            headerEl.innerHTML = `
                <i class="fa-solid fa-chevron-right tree-arrow"></i>
                <span class="node-title">${escapeHtml(layer.name)}</span>
            `;

            // Toggle Expand / Collapse
            headerEl.addEventListener('click', (e) => {
                nodeEl.classList.toggle('expanded');
                e.stopPropagation();
            });

            // Hover Sync: Highlight Byte Range in Hex View
            headerEl.addEventListener('mouseenter', () => highlightHexRange(layer.offset, layer.len));
            headerEl.addEventListener('mouseleave', () => clearHexHighlights());

            const childrenEl = document.createElement('div');
            childrenEl.className = 'node-children';

            if (layer.children) {
                layer.children.forEach(child => {
                    const fieldEl = document.createElement('div');
                    fieldEl.className = 'field-node';
                    fieldEl.dataset.offset = child.offset;
                    fieldEl.dataset.len = child.len;
                    fieldEl.textContent = child.name;

                    fieldEl.addEventListener('mouseenter', (e) => {
                        e.stopPropagation();
                        highlightHexRange(child.offset, child.len);
                    });
                    fieldEl.addEventListener('mouseleave', () => clearHexHighlights());
                    fieldEl.addEventListener('click', (e) => {
                        e.stopPropagation();
                        highlightHexRange(child.offset, child.len, true);
                    });

                    childrenEl.appendChild(fieldEl);
                });
            }

            nodeEl.appendChild(headerEl);
            nodeEl.appendChild(childrenEl);
            treeContainer.appendChild(nodeEl);
        });
    }

    /**
     * Renders Hex & ASCII View in #hex-viewer-container
     */
    function renderHexViewer(pkt) {
        const hexContainer = document.getElementById('hex-viewer-container');
        hexContainer.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'hex-grid';

        const bytes = pkt.rawData;
        const total = bytes.length;

        for (let offset = 0; offset < total; offset += 16) {
            const row = document.createElement('div');
            row.className = 'hex-row';

            // Offset column (0000, 0010...)
            const offsetCell = document.createElement('div');
            offsetCell.className = 'hex-offset';
            offsetCell.textContent = offset.toString(16).padStart(4, '0').toUpperCase();

            // Hex Bytes Cell
            const bytesCell = document.createElement('div');
            bytesCell.className = 'hex-bytes-cell';

            // ASCII Cell
            const asciiCell = document.createElement('div');
            asciiCell.className = 'hex-ascii-cell';

            for (let i = 0; i < 16; i++) {
                const byteIndex = offset + i;
                if (byteIndex < total) {
                    const byteVal = bytes[byteIndex];
                    const hexStr = byteVal.toString(16).padStart(2, '0').toUpperCase();

                    const byteSpan = document.createElement('span');
                    byteSpan.className = 'hex-byte';
                    byteSpan.dataset.index = byteIndex;
                    byteSpan.dataset.val = byteVal;
                    byteSpan.textContent = hexStr;

                    const charStr = (byteVal >= 32 && byteVal <= 126) ? String.fromCharCode(byteVal) : '.';
                    const asciiSpan = document.createElement('span');
                    asciiSpan.className = 'ascii-char';
                    asciiSpan.dataset.index = byteIndex;
                    asciiSpan.textContent = charStr;

                    // Hover Event on Hex Byte
                    const onByteHover = () => {
                        updateHexInfo(byteIndex, byteVal, charStr);
                        syncTreeHighlightFromByte(byteIndex);
                    };

                    byteSpan.addEventListener('mouseenter', onByteHover);
                    asciiSpan.addEventListener('mouseenter', onByteHover);

                    bytesCell.appendChild(byteSpan);
                    asciiCell.appendChild(asciiSpan);
                }
            }

            row.appendChild(offsetCell);
            row.appendChild(bytesCell);
            row.appendChild(asciiCell);
            grid.appendChild(row);
        }

        hexContainer.appendChild(grid);
    }

    /**
     * Highlights byte range in Hex Viewer based on Tree Node offset & length
     */
    function highlightHexRange(startOffset, length, isPersistent = false) {
        clearHexHighlights();

        const endOffset = startOffset + length;
        document.querySelectorAll('.hex-byte, .ascii-char').forEach(el => {
            const idx = parseInt(el.dataset.index, 10);
            if (idx >= startOffset && idx < endOffset) {
                el.classList.add('tree-highlight');
            }
        });
    }

    function clearHexHighlights() {
        document.querySelectorAll('.tree-highlight').forEach(el => {
            el.classList.remove('tree-highlight');
        });
    }

    /**
     * Updates Info bar in Hex Viewer Header
     */
    function updateHexInfo(index, val, char) {
        const hexInfo = document.getElementById('hex-hover-info');
        hexInfo.textContent = `Offset: 0x${index.toString(16).padStart(4,'0').toUpperCase()} (${index}) | Byte: 0x${val.toString(16).padStart(2,'0').toUpperCase()} (${val}) | ASCII: '${char}'`;
    }

    /**
     * Synchronizes Tree node highlight when hovering over a Hex Byte
     */
    function syncTreeHighlightFromByte(byteIndex) {
        document.querySelectorAll('.field-node, .node-header').forEach(el => {
            const offset = parseInt(el.dataset.offset, 10);
            const len = parseInt(el.dataset.len, 10);

            if (!isNaN(offset) && !isNaN(len) && byteIndex >= offset && byteIndex < offset + len) {
                el.classList.add('active-field-highlight');
            } else {
                el.classList.remove('active-field-highlight');
            }
        });
    }

    // =========================================================================
    // 6. UI ACTIONS & MODALS CONTROLLER
    // =========================================================================

    // Capture Buttons (Start, Stop, Restart, Clear)
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnRestart = document.getElementById('btn-restart');
    const btnClear = document.getElementById('btn-clear');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');

    btnStart.addEventListener('click', () => {
        state.isCapturing = true;
        btnStart.disabled = true; btnStart.classList.add('disabled');
        btnStop.disabled = false; btnStop.classList.remove('disabled');
        statusIndicator.className = 'status-indicator live';
        statusText.textContent = 'Status: Live Capture Active';
    });

    btnStop.addEventListener('click', () => {
        state.isCapturing = false;
        btnStop.disabled = true; btnStop.classList.add('disabled');
        btnStart.disabled = false; btnStart.classList.remove('disabled');
        statusIndicator.className = 'status-indicator stopped';
        statusText.textContent = 'Status: Capture Paused';
    });

    btnRestart.addEventListener('click', () => {
        state.packets = [];
        state.packetCounter = 0;
        state.captureStartTime = Date.now();
        state.selectedPacketId = null;
        state.stats.totalCount = 0;
        state.stats.bytesCaptured = 0;
        seedInitialPackets();
        btnStart.click();
    });

    btnClear.addEventListener('click', () => {
        state.packets = [];
        state.filteredPackets = [];
        state.selectedPacketId = null;
        state.stats.totalCount = 0;
        document.getElementById('tree-container').innerHTML = '<div class="tree-placeholder">Select a packet from the table above to view frame headers and payload hierarchy.</div>';
        document.getElementById('hex-viewer-container').innerHTML = '<div class="hex-placeholder">Select a packet to inspect raw bytes and ASCII decoded view.</div>';
        applyFilterAndRender();
    });

    // Interceptor Toggle
    document.getElementById('toggle-fetch-interceptor').addEventListener('change', (e) => {
        state.fetchInterceptorActive = e.target.checked;
    });

    // Protocol Filters
    document.getElementById('protocol-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-pill')) {
            document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
            e.target.classList.add('active');
            state.activeProtocolFilter = e.target.dataset.protocol;
            applyFilterAndRender();
        }
    });

    // Search Filter Input
    const filterInput = document.getElementById('filter-input');
    filterInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        applyFilterAndRender();
    });

    document.getElementById('btn-clear-filter').addEventListener('click', () => {
        filterInput.value = '';
        state.searchQuery = '';
        applyFilterAndRender();
    });

    // Auto-Scroll Checkbox
    document.getElementById('chk-autoscroll').addEventListener('change', (e) => {
        state.autoScroll = e.target.checked;
    });

    // Presets Dropdown
    const btnPresets = document.getElementById('btn-presets');
    const presetsMenu = document.getElementById('presets-menu');
    btnPresets.addEventListener('click', (e) => {
        e.stopPropagation();
        presetsMenu.classList.toggle('show');
    });

    document.addEventListener('click', () => presetsMenu.classList.remove('show'));

    presetsMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;
        const preset = item.dataset.preset;

        if (preset === 'web-browsing') {
            injectPackets([...generatorTemplates.dnsQuery(), ...generatorTemplates.httpGet()]);
        } else if (preset === 'websocket-chat') {
            injectPackets(generatorTemplates.wsChat());
        } else if (preset === 'dns-lookup') {
            injectPackets([...generatorTemplates.dnsQuery(), ...generatorTemplates.tlsHandshake()]);
        } else if (preset === 'tcp-handshake') {
            injectPackets(generatorTemplates.tcpHandshake());
        }
    });

    // Modals Handling
    function openModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    function closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.getElementById('btn-generator-modal').addEventListener('click', () => openModal('modal-traffic-generator'));

    // Traffic Generator Sliders
    const rangeCount = document.getElementById('gen-count');
    const valCount = document.getElementById('val-packet-count');
    rangeCount.addEventListener('input', () => valCount.textContent = rangeCount.value);

    const rangeRate = document.getElementById('gen-rate');
    const valRate = document.getElementById('val-packet-rate');
    rangeRate.addEventListener('input', () => valRate.textContent = rangeRate.value);

    // Generator Presets inside Modal
    document.getElementById('gen-http-get').addEventListener('click', () => { injectPackets(generatorTemplates.httpGet()); closeModal('modal-traffic-generator'); });
    document.getElementById('gen-http-post').addEventListener('click', () => { injectPackets(generatorTemplates.httpPost()); closeModal('modal-traffic-generator'); });
    document.getElementById('gen-ws-handshake').addEventListener('click', () => { injectPackets(generatorTemplates.wsChat()); closeModal('modal-traffic-generator'); });
    document.getElementById('gen-dns-burst').addEventListener('click', () => { injectPackets(generatorTemplates.dnsQuery()); closeModal('modal-traffic-generator'); });
    document.getElementById('gen-tls-handshake').addEventListener('click', () => { injectPackets(generatorTemplates.tlsHandshake()); closeModal('modal-traffic-generator'); });
    document.getElementById('gen-tcp-syn').addEventListener('click', () => { injectPackets(generatorTemplates.tcpHandshake()); closeModal('modal-traffic-generator'); });

    // Custom Generator Execute
    document.getElementById('btn-execute-burst').addEventListener('click', () => {
        const proto = document.getElementById('gen-protocol').value;
        const count = parseInt(rangeCount.value, 10);
        const customPayload = document.getElementById('gen-custom-payload').value || 'Standard Custom Burst Data Payload';

        const burstPackets = [];
        for (let i = 0; i < count; i++) {
            burstPackets.push({
                srcIp: `192.168.1.${Math.floor(Math.random() * 200 + 10)}`,
                dstIp: '104.21.32.8',
                srcPort: 50000 + i,
                dstPort: proto === 'HTTP' ? 80 : (proto === 'HTTPS' ? 443 : (proto === 'DNS' ? 53 : 8080)),
                protocol: proto,
                info: `${proto} Burst Frame #${i + 1}`,
                payloadText: `${customPayload} [Sequence ${i + 1}]`
            });
        }

        injectPackets(burstPackets);
        closeModal('modal-traffic-generator');
    });

    // Follow Stream Feature
    document.getElementById('btn-follow-stream').addEventListener('click', () => {
        if (!state.selectedPacketId) return;

        const selectedPkt = state.packets.find(p => p.id === state.selectedPacketId);
        if (!selectedPkt) return;

        const streamMeta = document.getElementById('stream-meta-info');
        const streamContent = document.getElementById('stream-content');

        streamMeta.textContent = `Follow Stream: ${selectedPkt.srcIp} <---> ${selectedPkt.dstIp} [Protocol: ${selectedPkt.protocol}]`;

        // Find matching related stream packets
        const relatedPackets = state.packets.filter(p => 
            (p.srcIp === selectedPkt.srcIp && p.dstIp === selectedPkt.dstIp) ||
            (p.srcIp === selectedPkt.dstIp && p.dstIp === selectedPkt.srcIp)
        );

        let streamHtml = '';
        relatedPackets.forEach(p => {
            const isClient = p.srcIp === selectedPkt.srcIp;
            const cls = isClient ? 'stream-client' : 'stream-server';
            const prefix = isClient ? '>>> Client: ' : '<<< Server: ';
            streamHtml += `<div class="${cls}"><strong>${prefix}</strong>${escapeHtml(p.payloadText || p.info)}\n</div>`;
        });

        streamContent.innerHTML = streamHtml || '<span class="text-muted">No reconstructible payload text in selected stream.</span>';
        openModal('modal-follow-stream');
    });

    // Copy Stream
    document.getElementById('btn-copy-stream').addEventListener('click', () => {
        const streamContent = document.getElementById('stream-content').innerText;
        navigator.clipboard.writeText(streamContent).then(() => {
            alert('Stream payload copied to clipboard!');
        });
    });

    // Export / Import Functionality
    document.getElementById('btn-export').addEventListener('click', () => {
        const exportData = state.packets.map(p => ({
            id: p.id,
            time: p.time,
            srcIp: p.srcIp,
            dstIp: p.dstIp,
            protocol: p.protocol,
            len: p.len,
            info: p.info,
            payloadText: p.payloadText,
            hexBytes: Array.from(p.rawData)
        }));

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `netsniff_capture_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    const fileImportInput = document.getElementById('file-import-input');
    document.getElementById('btn-import-trigger').addEventListener('click', () => fileImportInput.click());

    fileImportInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                state.packets = [];
                state.packetCounter = 0;

                importedData.forEach(item => {
                    const [srcIp, srcPort] = item.srcIp.split(':');
                    const [dstIp, dstPort] = item.dstIp.split(':');

                    const pkt = buildPacketFrame({
                        srcIp: srcIp || '192.168.1.1',
                        dstIp: dstIp || '10.0.0.1',
                        srcPort: parseInt(srcPort, 10) || 80,
                        dstPort: parseInt(dstPort, 10) || 80,
                        protocol: item.protocol || 'HTTP',
                        info: item.info || 'Imported Packet',
                        payloadText: item.payloadText || ''
                    });

                    state.packets.push(pkt);
                    state.stats.totalCount++;
                });

                applyFilterAndRender();
                alert(`Successfully imported ${importedData.length} packets!`);
            } catch (err) {
                alert('Failed to parse capture JSON file: ' + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Split Pane Resizing Engine
    setupPaneResizers();

    function setupPaneResizers() {
        const mainResizer = document.getElementById('resizer-main');
        const paneList = document.getElementById('pane-list');
        const paneDetails = document.getElementById('pane-details');

        let isResizingMain = false;

        mainResizer.addEventListener('mousedown', () => {
            isResizingMain = true;
            mainResizer.classList.add('dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizingMain) return;
            const containerHeight = document.querySelector('.workspace-layout').clientHeight;
            const topHeight = e.clientY - document.querySelector('.app-header').clientHeight - document.querySelector('.filter-toolbar').clientHeight;

            if (topHeight > 100 && (containerHeight - topHeight) > 100) {
                paneList.style.flex = 'none';
                paneList.style.height = `${topHeight}px`;
                paneDetails.style.flex = '1';
            }
        });

        document.addEventListener('mouseup', () => {
            isResizingMain = false;
            mainResizer.classList.remove('dragging');
        });
    }

    // Helper Utility
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // Initialize App
    setupFetchInterceptor();
    seedInitialPackets();
});
