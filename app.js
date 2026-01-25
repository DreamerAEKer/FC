// app.js

/**
 * Data Store & State Management
 */
const Store = {
    data: {
        trips: [],
        friends: [],
        currentTripId: null
    },

    init() {
        const savedData = localStorage.getItem('saduak_data');
        if (savedData) {
            this.data = JSON.parse(savedData);
        } else {
            // Seed initial data for demo
            this.seedData();
        }
    },

    save() {
        localStorage.setItem('saduak_data', JSON.stringify(this.data));
    },

    seedData() {
        // Initial dummy data
        this.data.trips = [
            // { id: 't1', name: 'ทริปเชียงใหม่', date: new Date().toISOString() }
        ];
    },

    addTrip(name) {
        const newTrip = {
            id: 't' + Date.now() + Math.random().toString(36).substr(2, 5), // Enhanced uniqueness
            name: name,
            date: new Date().toISOString(),
            status: 'active',
            members: [],
            expenses: []
        };
        this.data.trips.unshift(newTrip);
        this.save();
        return newTrip;
    },

    // --- Distributed Sync Logic ---

    /**
     * Export a trip to a compressed string.
     * Privacy: Filter out expenses where involvedIds is ONLY the payer (Personal)
     * unless IncludePrivate is true (for personal backup).
     */
    exportTripString(tripId, includePrivate = false) {
        const trip = this.data.trips.find(t => t.id === tripId);
        if (!trip) return null;

        // Clone to avoid mutating store
        const tripClone = JSON.parse(JSON.stringify(trip));

        // FIX: Embed Member Profiles (names/photos) so receiver knows who they are
        tripClone._embeddedMembers = tripClone.members
            .map(mId => this.data.friends.find(f => f.id === mId))
            .filter(Boolean);

        if (!includePrivate && tripClone.expenses) {
            tripClone.expenses = tripClone.expenses.filter(e => {
                // Keep if involved > 1 OR involved is not just me (conceptually).
                // For simplified logic: If involvedIds includes more than 1 person, it's shared.
                // If involvedIds is 1 person AND it's the payer, it's private.
                const isPrivate = e.involvedIds.length === 1 && e.involvedIds[0] === e.payerId;
                return !isPrivate;
            });
        }

        // Lightweight compression: JSON -> String -> Base64
        // In prod, we'd use LZ-string.
        try {
            const jsonStr = JSON.stringify(tripClone);
            return btoa(unescape(encodeURIComponent(jsonStr))); // UTF-8 safe Base64
        } catch (e) {
            console.error('Export failed', e);
            return null;
        }
    },

    /**
     * Import and Merge a trip string.
     * Logic: Upsert expenses and Members.
     */
    importTripString(encodedStr) {
        try {
            const jsonStr = decodeURIComponent(escape(atob(encodedStr)));
            const incomingTrip = JSON.parse(jsonStr);

            // FIX: Import Embedded Members
            if (incomingTrip._embeddedMembers) {
                const myFriends = this.data.friends;
                incomingTrip._embeddedMembers.forEach(incomingFriend => {
                    const exists = myFriends.find(f => f.id === incomingFriend.id);
                    if (!exists) {
                        myFriends.push(incomingFriend);
                    }
                });
                delete incomingTrip._embeddedMembers; // Clean up
            }

            // Find existing trip or create new
            let existingTrip = this.data.trips.find(t => t.id === incomingTrip.id);

            if (!existingTrip) {
                // New Trip
                this.data.trips.unshift(incomingTrip);
            } else {
                // Merge Logic
                // 1. Merge Members (Union)
                const existingMembers = new Set(existingTrip.members || []);
                (incomingTrip.members || []).forEach(mId => existingMembers.add(mId));
                existingTrip.members = Array.from(existingMembers);

                // 2. Merge Expenses (Upsert by ID)
                if (!existingTrip.expenses) existingTrip.expenses = [];
                const expenseMap = new Map();
                existingTrip.expenses.forEach(e => expenseMap.set(e.id, e));

                (incomingTrip.expenses || []).forEach(e => {
                    // Overwrite if incoming is newer? Or just trust incoming as 'update'?
                    // For simplicity: Incoming overwrites existing (Last Write Wins roughly).
                    expenseMap.set(e.id, e);
                });

                existingTrip.expenses = Array.from(expenseMap.values());

                // Sort by timestamp desc
                existingTrip.expenses.sort((a, b) => b.timestamp - a.timestamp);
            }

            // Sync global friends if needed? 
            // Ideally we should sync friend details too, but friends are global ID linked.
            // For this prototype, we assume friend IDs match if created on one device and shared.
            // (To fix properly: Trip needs to carry concise Friend Profiles too).

            this.save();
            return incomingTrip.id;
        } catch (e) {
            console.error('Import failed', e);
            alert('รหัสไม่ถูกต้อง หรือข้อมูลเสียหาย');
            return null;
        }
    }
};

/**
 * View Management
 */
const ViewManager = {
    init() {
        // Expose to window for inline onclick handlers
        window.Store = Store;
        window.ViewManager = this;

        // Bind Nav Buttons
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = btn.dataset.target;
                if (target) this.navigateTo(target);

                // Update active state
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                if (!btn.classList.contains('fab')) btn.classList.add('active');
            });
        });

        // Quick Add Button
        document.getElementById('btn-quick-add').addEventListener('click', () => {
            alert('ฟีเจอร์เพิ่มเร็ว (Quick Add) กำลังมาครับ!');
        });

        // Note: We don't bind hero buttons here because renderHome() will overwrite them.
        // We rely on renderHome() to set up its own listeners.

        this.renderHome();
    },

    navigateTo(viewName) {
        console.log('Navigating to:', viewName);
        // Simple View Switching Logic (To be expanded)
        if (viewName === 'home') {
            this.renderHome();
        } else {
            // Placeholder for other views
            const mainContent = document.getElementById('main-content');
            mainContent.innerHTML = `<div style="text-align:center; padding-top: 50px;">
                <span class="material-icons-round" style="font-size: 48px; color: #ccc;">construction</span>
                <h3>หน้า ${viewName} กำลังสร้างครับ</h3>
            </div>`;
        }
    },

    renderHome() {
        const mainContent = document.getElementById('main-content');

        // Re-render standard Home View structure
        mainContent.innerHTML = `
            <div id="home-view" class="view active">
                <div class="welcome-card">
                    <h2>ยินดีต้อนรับ!</h2>
                    <p>เริ่มจัดการค่าใช้จ่ายได้เลย</p>
                    <div style="display:flex; gap:8px; margin-bottom: 12px;">
                        <button id="btn-create-trip-hero" class="btn btn-primary" style="flex:1; justify-content:center;">
                            <span class="material-icons-round">add</span> ค่าใช้จ่ายใหม่
                        </button>
                         <button id="btn-import-card" class="btn" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.4);">
                            <span class="material-icons-round">qr_code_scanner</span> นำเข้าการ์ด
                        </button>
                    </div>
                    
                    <!-- Hidden File Input -->
                    <input type="file" id="inp-scan-file" accept="image/*" style="display:none;">
                    
                    <div style="text-align: center; margin-top: 8px;">
                         <a href="#" id="link-manual-join" style="color: rgba(255,255,255,0.8); font-size: 0.8rem; text-decoration: none; border-bottom: 1px dotted rgba(255,255,255,0.5);">กรอกรหัสด้วยตัวเอง</a>
                    </div>
                </div>

                <div class="section-title">
                    <h3>ทริปของคุณ</h3>
                </div>
                <div id="trip-list" class="trip-list"></div>
            </div>
        `;

        // Re-bind hero buttons
        document.getElementById('btn-create-trip-hero').addEventListener('click', () => this.createNewTrip());

        // Scan Logic (Now on the main button)
        const fileInput = document.getElementById('inp-scan-file');
        document.getElementById('btn-import-card').addEventListener('click', () => fileInput.click());

        // Manual Join Logic
        document.getElementById('link-manual-join').addEventListener('click', (e) => {
            e.preventDefault();
            this.promptJoinTrip();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    context.drawImage(img, 0, 0);
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });

                    if (code) {
                        console.log("Found QR code", code.data);
                        const tripId = Store.importTripString(code.data);
                        if (tripId) {
                            alert('นำเข้าข้อมูลเรียบร้อย!');
                            this.renderTripList();
                        }
                    } else {
                        alert('ไม่พบ QR Code ในภาพนี้');
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        this.renderTripList();
    },

    promptJoinTrip() {
        const code = prompt('วางโค้ดทริปที่เพื่อนแชร์มาที่นี่:');
        if (code) {
            const tripId = Store.importTripString(code);
            if (tripId) {
                alert('เข้าร่วมสำเร็จ!');
                this.renderTripList();
            }
        }
    },

    renderTripList() {
        const listContainer = document.getElementById('trip-list');
        const trips = Store.data.trips;

        if (trips.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; color: #999; padding: 20px;">
                    <span class="material-icons-round" style="font-size: 48px;">luggage</span>
                    <p>ยังไม่มีทริป</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = trips.map(trip => `
            <div class="trip-card" onclick="ViewManager.openTrip('${trip.id}')" style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                <div>
                    <h4 style="font-size: 1.1rem; margin-bottom: 4px;">${trip.name}</h4>
                    <span style="font-size: 0.85rem; color: #666;">${new Date(trip.date).toLocaleDateString('th-TH')}</span>
                </div>
                <button class="btn" style="background: #f0f0f0; border-radius: 50%; width: 40px; height: 40px; padding: 0; justify-content: center;">
                    <span class="material-icons-round">arrow_forward</span>
                </button>
            </div>
        `).join('');
    },

    createNewTrip() {
        const name = prompt('ชื่อทริปของคุณ (เช่น เที่ยวเชียงใหม่):');
        if (name) {
            Store.addTrip(name);
            this.renderTripList();
        }
    },

    openTrip(tripId) {
        Store.data.currentTripId = tripId;
        this.renderTripDetail(tripId);
    },

    renderTripDetail(tripId) {
        const trip = Store.data.trips.find(t => t.id === tripId);
        if (!trip) return this.renderHome();

        const mainContent = document.getElementById('main-content');

        // Calculate totals (placeholder)
        const totalExpense = trip.expenses ? trip.expenses.reduce((sum, e) => sum + e.amount, 0) : 0;

        mainContent.innerHTML = `
            <div id="trip-detail-view" class="view active">
                <!-- Trip Header -->
                <div class="trip-header text-center" style="margin-bottom: 24px;">
                    <button class="btn" id="btn-back-home" style="position: absolute; left: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: white; box-shadow: var(--shadow-sm);">
                        <span class="material-icons-round">arrow_back</span>
                    </button>
                    <!-- Share Button -->
                     <button class="btn" id="btn-share-trip" style="position: absolute; right: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: rgba(255,255,255,0.9); box-shadow: var(--shadow-sm); color: var(--primary-color);">
                        <span class="material-icons-round">ios_share</span>
                    </button>

                    <div id="trip-title-container" style="display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.2s;" 
                         ontouchstart="this.style.background='rgba(0,0,0,0.05)'" 
                         ontouchend="this.style.background='transparent'"
                         onmousedown="this.style.background='rgba(0,0,0,0.05)'" 
                         onmouseup="this.style.background='transparent'">
                        <h2 style="border-bottom: 1px dotted rgba(0,0,0,0.2); display: inline-block; margin: 0;">${trip.name}</h2>
                        <span class="material-icons-round" style="font-size: 18px; color: var(--primary-color);">edit</span>
                    </div>
                    <p style="color: #666; margin-top: 4px;">${new Date(trip.date).toLocaleDateString('th-TH')}</p>
                    
                    <div class="expense-summary" style="margin-top: 16px; background: var(--primary-gradient); color: white; padding: 24px; border-radius: 20px; box-shadow: var(--shadow-md);">
                        <p style="opacity: 0.9; font-size: 0.9rem;">ยอดรวมทั้งหมด</p>
                        <h1 style="font-size: 2.5rem; font-weight: 600;">฿${totalExpense.toLocaleString()}</h1>
                    </div>
                </div>

                <!-- Action Bar -->
                <div class="action-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
                    <button id="btn-add-expense" class="btn btn-primary" style="justify-content: center;">
                        <span class="material-icons-round">receipt_long</span> จดค่าใช้จ่าย
                    </button>
                    <button id="btn-settle" class="btn" style="background: white; border: 1px solid #ddd; justify-content: center;">
                        <span class="material-icons-round">payments</span> เคลียร์บิล
                    </button>
                </div>

                <!-- Members Section -->
                <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3>สมาชิก (${trip.members ? trip.members.length : 0})</h3>
                    <button id="btn-add-member" class="btn" style="padding: 4px 12px; font-size: 0.8rem; height: auto;">
                        <span class="material-icons-round" style="font-size: 18px;">person_add</span>
                    </button>
                </div>
                <div class="members-scroll" style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 24px;">
                    ${this.renderTripMembers(trip.members || [])}
                </div>

                <!-- Expenses List -->
                <h3>รายการล่าสุด</h3>
                <div id="trip-expenses-list">
                    ${this.renderExpenseList(trip.expenses || [])}
                </div>
            </div>
        `;

        // Event Listeners
        document.getElementById('btn-back-home').addEventListener('click', () => {
            Store.data.currentTripId = null;
            this.renderHome();
        });

        // Edit Trip Name (Target the whole container for better mobile touch area)
        const tripTitleContainer = document.getElementById('trip-title-container');
        if (tripTitleContainer) {
            tripTitleContainer.addEventListener('click', () => {
                const newName = prompt('แก้ไขชื่อทริป:', trip.name);
                if (newName && newName.trim()) {
                    trip.name = newName.trim();
                    Store.save();
                    this.renderTripDetail(tripId);
                }
            });
        }

        document.getElementById('btn-share-trip').addEventListener('click', () => {
            const code = Store.exportTripString(tripId);
            if (code) {
                // In a real app we might use navigator.share
                navigator.clipboard.writeText(code).then(() => {
                    alert('ก๊อปปี้โค้ดแล้ว! ส่งให้เพื่อนในแชทได้เลยครับ (โค้ดนี้ใช้รวมข้อมูลได้ด้วย)');
                });
            }
        });

        document.getElementById('btn-add-member').addEventListener('click', () => {
            this.promptAddMemberToTrip(tripId);
        });

        document.getElementById('btn-add-expense').addEventListener('click', () => {
            this.renderAddExpense(tripId);
        });

        document.getElementById('btn-settle').addEventListener('click', () => {
            this.renderSettlement(tripId);
        });
    },

    renderAddExpense(tripId) {
        const trip = Store.data.trips.find(t => t.id === tripId);
        const members = trip.members.map(id => Store.data.friends.find(f => f.id === id)).filter(Boolean);

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div id="add-expense-view" class="view active">
                <div class="trip-header text-center" style="margin-bottom: 24px;">
                    <button class="btn" id="btn-back-trip" style="position: absolute; left: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: white; box-shadow: var(--shadow-sm);">
                        <span class="material-icons-round">arrow_back</span>
                    </button>
                    <h3>จดค่าใช้จ่าย</h3>
                </div>

                <form id="form-expense">
                    <!-- Amount Input -->
                    <div class="input-group" style="margin-bottom: 24px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">จำนวนเงิน</label>
                        <input type="number" id="inp-amount" placeholder="0.00" style="width: 100%; font-size: 2rem; padding: 12px; border: 2px solid #eee; border-radius: 12px; text-align: center; color: var(--primary-color); font-weight: 600;" required>
                    </div>

                    <!-- Title Input + Voice/Photo -->
                    <div class="input-group" style="margin-bottom: 24px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">รายการ</label>
                         <div style="display: flex; gap: 8px;">
                            <input type="text" id="inp-title" placeholder="ค่าอะไร (เช่น ข้าวซอย)" style="flex:1; padding: 12px; border: 1px solid #ddd; border-radius: 8px;" required>
                            
                            <!-- Voice Input -->
                            <button type="button" id="btn-voice" class="btn" style="background:#eee; padding: 8px 12px; position:relative;">
                                <span class="material-icons-round">mic</span>
                            </button>

                            <!-- Manual Type (Fallback) -->
                             <button type="button" id="btn-keyboard-fallback" class="btn" style="background:#eee; padding: 8px 12px;">
                                <span class="material-icons-round">keyboard</span>
                            </button>

                             <!-- Camera -->
                             <button type="button" id="btn-camera" class="btn" style="background:#eee; padding: 8px 12px;">
                                <span class="material-icons-round">camera_alt</span>
                            </button>
                        </div>
                    </div>

                    <!-- Payer -->
                    <div class="input-group" style="margin-bottom: 24px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">ใครจ่าย</label>
                        <div style="display: flex; overflow-x: auto; gap: 8px; padding-bottom: 8px;">
                            ${members.map((m, i) => `
                                <label class="radio-chip">
                                    <input type="radio" name="payer" value="${m.id}" ${i === 0 ? 'checked' : ''} style="display:none;">
                                    <div class="chip" style="padding: 8px 16px; background: #f0f0f0; border-radius: 20px; white-space: nowrap; cursor: pointer; border: 2px solid transparent;">
                                        ${m.name}
                                    </div>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                     <!-- Split Among -->
                    <div class="input-group" style="margin-bottom: 32px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">หารกับใครบ้าง</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            ${members.map(m => `
                                <label class="checkbox-chip" style="display: flex; align-items: center; gap: 8px; padding: 8px; background: #fff; border: 1px solid #eee; border-radius: 8px;">
                                    <input type="checkbox" name="involved" value="${m.id}" checked>
                                    <span>${m.name}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 16px;">
                        บันทึกรายการ
                    </button>
                </form>
            </div>
        `;

        // Styling for radio/checkbox interaction
        // Styling for radio/checkbox interaction
        const inputs = mainContent.querySelectorAll('.radio-chip input, .checkbox-chip input');

        const updateChipStyle = () => {
            inputs.forEach(input => {
                if (input.type === 'radio') {
                    // Radio: Visual is the sibling .chip div
                    const chip = input.nextElementSibling;
                    if (input.checked) {
                        chip.style.background = 'var(--primary-light)';
                        chip.style.color = 'white';
                        chip.style.borderColor = 'var(--primary-color)';
                        chip.style.fontWeight = '600';
                    } else {
                        chip.style.background = '#f0f0f0';
                        chip.style.color = 'black';
                        chip.style.borderColor = 'transparent';
                        chip.style.fontWeight = '400';
                    }
                } else if (input.type === 'checkbox') {
                    // Checkbox: Visual is the parent label itself
                    const label = input.parentElement;
                    if (input.checked) {
                        label.style.background = 'var(--primary-light)';
                        label.style.color = 'white';
                        label.style.borderColor = 'var(--primary-color)';
                        label.style.fontWeight = '500';
                    } else {
                        label.style.background = '#fff';
                        label.style.color = 'black';
                        label.style.borderColor = '#eee';
                        label.style.fontWeight = '400';
                    }
                }
            });
        };

        inputs.forEach(c => c.addEventListener('change', updateChipStyle));
        updateChipStyle();

        // Listeners
        document.getElementById('btn-back-trip').addEventListener('click', () => {
            this.renderTripDetail(tripId);
        });

        document.getElementById('form-expense').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitExpense(tripId);
        });

        // Voice Recognition (Web Speech API)
        document.getElementById('btn-voice').addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

            if (!SpeechRecognition) {
                alert('เบราว์เซอร์นี้ไม่รองรับการสั่งงานด้วยเสียง \n(แนะนำให้ใช้ Chrome หรือ Safari)');
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.lang = 'th-TH'; // Thai Language
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            const btnVoice = document.getElementById('btn-voice');

            // Visual Feedback: Listening State
            btnVoice.style.background = '#ff5252'; // Red indicating recording
            btnVoice.style.color = 'white';

            recognition.start();

            recognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                document.getElementById('inp-title').value = text;
            };

            recognition.onspeechend = () => {
                recognition.stop();
                resetVoiceBtn();
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                resetVoiceBtn();

                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    // Fallback for Permission Denied or Insecure Origin (file://)
                    const fallbackText = prompt('ระบบเสียงไม่ได้รับอนุญาต (อาจเพราะเปิดไฟล์โดยตรง)\nพิมพ์รายการที่ต้องการแทนได้เลยครับ:');
                    if (fallbackText) document.getElementById('inp-title').value = fallbackText;
                } else if (event.error === 'no-speech') {
                    // Just ignore if silence
                } else {
                    alert('เกิดข้อขัดข้องกับระบบเสียง: ' + event.error);
                }
            };

            function resetVoiceBtn() {
                btnVoice.style.background = '#eee';
                btnVoice.style.color = 'black';
            }
        });

        // Manual Keyboard Fallback
        document.getElementById('btn-keyboard-fallback').addEventListener('click', () => {
            const fallbackText = prompt('พิมพ์รายการสินค้า (Manual Entry):');
            if (fallbackText) document.getElementById('inp-title').value = fallbackText;
        });

        // Mock Camera
        document.getElementById('btn-camera').addEventListener('click', () => {
            alert('Simulated: Opened Camera / Selected Photo. OCR Scanning...');
            setTimeout(() => {
                document.getElementById('inp-title').value = "ใบเสร็จ 7-11";
                document.getElementById('inp-amount').value = 350;
            }, 1000);
        });
    },

    submitExpense(tripId) {
        const amount = parseFloat(document.getElementById('inp-amount').value);
        const title = document.getElementById('inp-title').value;
        const payerRadio = document.querySelector('input[name="payer"]:checked');
        const payerId = payerRadio ? payerRadio.value : null;

        const involvedNodes = document.querySelectorAll('input[name="involved"]:checked');
        const involvedIds = Array.from(involvedNodes).map(box => box.value);

        if (!amount || !title) {
            alert('กรุณากรอกข้อมูลให้ครบ');
            return;
        }
        if (!payerId) {
            alert('กรุณาระบุคนจ่าย');
            return;
        }
        if (involvedIds.length === 0) {
            alert('ต้องมีคนหารอย่างน้อย 1 คน');
            return;
        }

        const newExpense = {
            id: 'e' + Date.now(),
            tripId,
            title,
            amount,
            payerId,
            involvedIds,
            timestamp: Date.now()
        };

        const trip = Store.data.trips.find(t => t.id === tripId);
        if (!trip.expenses) trip.expenses = [];
        trip.expenses.unshift(newExpense);

        Store.save();

        // --- Prompt Generate Card ---
        if (confirm('บันทึกแล้ว! สร้างการ์ดสรุปยอดเพื่อส่งให้เพื่อนเลยไหม?')) {
            this.renderCardPreview(trip, newExpense);
        } else {
            this.renderTripDetail(tripId);
        }
    },

    /**
     * Expense Card System
     */
    renderCardPreview(trip, expense) {
        const payer = Store.data.friends.find(f => f.id === expense.payerId);

        // Basic PromptPay Logic
        let promptPayPayload = null;
        if (payer && payer.phone) {
            let phone = payer.phone.replace(/[^0-9]/g, '');
            if (phone.startsWith('0')) phone = '66' + phone.substring(1);
            promptPayPayload = this.generatePromptPayPayload(phone, expense.amount);
        }

        // Data QR Payload
        // Use standard export to ensure members are embedded and logic is consistent
        const syncStr = Store.exportTripString(trip.id, false);

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div id="card-preview-view" class="view active" style="padding: 24px; display:flex; flex-direction:column; align-items:center;">
                <h3>การ์ดเรียกเก็บเงิน</h3>
                
                <!-- The Card -->
                <div id="expense-card" style="background: white; width: 100%; max-width: 320px; padding: 24px; border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); position: relative; overflow: hidden; margin-bottom: 24px;">
                    <!-- Decor -->
                    <div style="position: absolute; top:0; left:0; right:0; height: 8px; background: linear-gradient(135deg, #6200EE 0%, #3700b3 100%);"></div>
                    
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h4 style="color: #666; font-size: 0.9rem; margin:0;">${trip.name}</h4>
                        <div style="font-size: 1.5rem; font-weight: 600; margin: 8px 0;">${expense.title}</div>
                        <div style="font-size: 2.5rem; font-weight: 700; color: #6200EE;">฿${expense.amount.toLocaleString()}</div>
                        <div style="font-size: 0.8rem; color: #888;">${new Date(expense.timestamp).toLocaleDateString()} ${new Date(expense.timestamp).toLocaleTimeString()}</div>
                    </div>

                    <div style="border-top: 2px dashed #eee; margin: 16px 0;"></div>

                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                         <div style="text-align: center; flex: 1;">
                            <div style="font-size: 0.8rem; color: #888; margin-bottom: 4px;">จ่ายเงินให้</div>
                            <div style="font-weight: 600; font-size: 0.9rem;">${payer ? payer.name : 'Unknown'}</div>
                            ${promptPayPayload ? `
                                <div id="qrcode-payment" style="margin-top: 8px; display:flex; justify-content:center;"></div>
                                <div style="font-size: 0.6rem; color: #aaa; margin-top: 2px;">PromptPay</div>
                            ` : '<div style="font-size:0.7rem; color:#ccc; margin-top:8px;">(ไม่มีเบอร์)</div>'}
                         </div>
                         <div style="text-align: center; flex: 1; border-left: 1px solid #eee;">
                            <div style="font-size: 0.8rem; color: #888; margin-bottom: 4px;">บันทึกข้อมูล</div>
                            <div style="font-weight: 600; font-size: 0.9rem;">สแกนเพื่อรวมบิล</div>
                            <div id="qrcode-data" style="margin-top: 8px; display:flex; justify-content:center;"></div>
                            <div style="font-size: 0.6rem; color: #aaa; margin-top: 2px;">App Data</div>
                         </div>
                    </div>
                    
                    <div style="text-align:center; font-size: 0.7rem; color: #ccc; margin-top: 16px;">
                        สะดวกแบบนี้ (Saduak Bab Nee)
                    </div>
                </div>

                <div style="display: flex; gap: 12px; width: 100%; max-width: 320px;">
                    <button class="btn" id="btn-cancel-card" style="flex: 1; justify-content: center; background: #eee;">กลับ</button>
                    <button class="btn btn-primary" id="btn-save-card" style="flex: 1; justify-content: center;">บันทึกรูปภาพ</button>
                </div>
            </div>
        `;

        // Generate QRs
        if (promptPayPayload) {
            new QRCode(document.getElementById("qrcode-payment"), {
                text: promptPayPayload,
                width: 80,
                height: 80,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.L
            });
        }

        new QRCode(document.getElementById("qrcode-data"), {
            text: syncStr,
            width: 80,
            height: 80,
            colorDark: "#6200EE",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L
        });

        // Listeners
        document.getElementById('btn-cancel-card').addEventListener('click', () => {
            this.renderTripDetail(trip.id);
        });

        document.getElementById('btn-save-card').addEventListener('click', () => {
            const card = document.getElementById('expense-card');
            html2canvas(card, { scale: 3 }).then(canvas => {
                const link = document.createElement('a');
                link.download = `Saduak-${expense.title}.png`;
                link.href = canvas.toDataURL();
                link.click();
            });
        });
    },

    generatePromptPayPayload(target, amount) {
        // Dummy PromptPay Generator (No CRC) - For Visual Demo Only
        // Returns a raw string format that looks like PromptPay
        return `00020101021129370016A000000677010111011300${target}530376454${this.formatAmount(amount)}5802TH6304`;
    },

    formatAmount(amount) {
        let str = amount.toFixed(2);
        let len = str.length;
        return (len < 10 ? '0' + len : len) + str;
    },

    renderSettlement(tripId) {
        const trip = Store.data.trips.find(t => t.id === tripId);
        const members = trip.members.map(id => Store.data.friends.find(f => f.id === id)).filter(Boolean);

        // Calculate Balances
        const balances = {}; // memberId -> balance
        trip.members.forEach(id => balances[id] = 0);

        if (trip.expenses) {
            trip.expenses.forEach(e => {
                // Payer gets credit
                balances[e.payerId] += e.amount;

                // Involved people get debt
                const splitAmount = e.amount / e.involvedIds.length;
                e.involvedIds.forEach(id => {
                    balances[id] -= splitAmount;
                });
            });
        }

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
             <div id="settle-view" class="view active">
                <div class="trip-header text-center" style="margin-bottom: 24px;">
                    <button class="btn" id="btn-back-trip-settle" style="position: absolute; left: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: white; box-shadow: var(--shadow-sm);">
                        <span class="material-icons-round">arrow_back</span>
                    </button>
                    <h3>สรุปยอดเคลียร์บิล</h3>
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="margin-bottom: 12px;">สรุปยอดคงเหลือรายคน</h4>
                    ${members.map(m => {
            const bal = balances[m.id] || 0;
            const isPlus = bal >= 0;
            return `
                            <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${isPlus ? '#4CAF50' : '#F44336'};">
                                <span>${m.name}</span>
                                <span style="font-weight: 600; color: ${isPlus ? '#4CAF50' : '#F44336'};">
                                    ${isPlus ? '+' : ''}${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        `;
        }).join('')}
                </div>

                <div>
                    <h4 style="margin-bottom: 12px;">ใครต้องโอนให้ใคร</h4>
                    <!-- Simple Debt Matching -->
                    ${this.calculateDebtTransfers(balances, members)}
                </div>
             </div>
        `;

        document.getElementById('btn-back-trip-settle').addEventListener('click', () => {
            this.renderTripDetail(tripId);
        });
    },

    calculateDebtTransfers(balances, members) {
        let debtors = [];
        let creditors = [];

        for (const [id, amount] of Object.entries(balances)) {
            if (Math.abs(amount) < 0.01) continue;
            if (amount > 0) creditors.push({ id, amount });
            if (amount < 0) debtors.push({ id, amount });
        }

        debtors.sort((a, b) => a.amount - b.amount);
        creditors.sort((a, b) => b.amount - a.amount);

        let html = '';
        let i = 0;
        let j = 0;

        if (debtors.length === 0 && creditors.length === 0) {
            return `<div style="text-align:center; color:#888;">เคลียร์หมดแล้วจ้า!</div>`;
        }

        while (i < debtors.length && j < creditors.length) {
            let debtor = debtors[i];
            let creditor = creditors[j];

            let amount = Math.min(Math.abs(debtor.amount), creditor.amount);
            let dName = members.find(m => m.id === debtor.id)?.name || 'Unknown';
            let cName = members.find(m => m.id === creditor.id)?.name || 'Unknown';

            html += `
                <div style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap:8px;">
                         <span style="font-weight:500; color: #F44336;">${dName}</span>
                         <span class="material-icons-round" style="color:#ccc; font-size:16px;">arrow_forward</span>
                         <span style="font-weight:500; color: #4CAF50;">${cName}</span>
                    </div>
                    <span style="font-weight:600;">฿${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            `;

            debtor.amount += amount;
            creditor.amount -= amount;

            if (Math.abs(debtor.amount) < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return html;
    },

    /**
     * Settle / Clearing Logic
     */
    renderSettlement(tripId) {
        const trip = Store.data.trips.find(t => t.id === tripId);
        const members = trip.members.map(id => Store.data.friends.find(f => f.id === id)).filter(Boolean);

        // Calculate Balances
        const balances = {}; // memberId -> balance (positive = owed to them, negative = they owe)
        trip.members.forEach(id => balances[id] = 0);

        if (trip.expenses) {
            trip.expenses.forEach(e => {
                // Payer gets credit
                balances[e.payerId] += e.amount;

                // Involved people get debt
                const splitAmount = e.amount / e.involvedIds.length;
                e.involvedIds.forEach(id => {
                    balances[id] -= splitAmount;
                });
            });
        }

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
             <div id="settle-view" class="view active">
                <div class="trip-header text-center" style="margin-bottom: 24px;">
                    <button class="btn" id="btn-back-trip-settle" style="position: absolute; left: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: white; box-shadow: var(--shadow-sm);">
                        <span class="material-icons-round">arrow_back</span>
                    </button>
                    <h3>สรุปยอดเคลียร์บิล</h3>
                </div>

                <div style="margin-bottom: 24px;">
                    <h4 style="margin-bottom: 12px;">สรุปยอดคงเหลือรายคน</h4>
                    ${members.map(m => {
            const bal = balances[m.id] || 0;
            const isPlus = bal >= 0;
            return `
                            <div style="display: flex; justify-content: space-between; padding: 12px; background: white; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${isPlus ? '#4CAF50' : '#F44336'};">
                                <span>${m.name}</span>
                                <span style="font-weight: 600; color: ${isPlus ? '#4CAF50' : '#F44336'};">
                                    ${isPlus ? '+' : ''}${bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        `;
        }).join('')}
                </div>

                <div>
                    <h4 style="margin-bottom: 12px;">ใครต้องโอนให้ใคร</h4>
                    <!-- Simple Debt Matching (Greedy Algorithm for display) -->
                    ${this.calculateDebtTransfers(balances, members)}
                </div>
             </div>
        `;

        document.getElementById('btn-back-trip-settle').addEventListener('click', () => {
            this.renderTripDetail(tripId);
        });
    },

    calculateDebtTransfers(balances, members) {
        // Convert balances to array
        let debtors = [];
        let creditors = [];

        for (const [id, amount] of Object.entries(balances)) {
            // Precision adjustment
            if (Math.abs(amount) < 0.01) continue;
            if (amount > 0) creditors.push({ id, amount });
            if (amount < 0) debtors.push({ id, amount });
        }

        debtors.sort((a, b) => a.amount - b.amount); // Most negative first
        creditors.sort((a, b) => b.amount - a.amount); // Most positive first

        let html = '';
        let i = 0; // debtor index
        let j = 0; // creditor index

        if (debtors.length === 0 && creditors.length === 0) {
            return `<div style="text-align:center; color:#888;">เคลียร์หมดแล้วจ้า!</div>`;
        }

        while (i < debtors.length && j < creditors.length) {
            let debtor = debtors[i];
            let creditor = creditors[j];

            // The amount to settle is the minimum of what debtor owes and what creditor is owed
            let amount = Math.min(Math.abs(debtor.amount), creditor.amount);

            // Get names
            let dName = members.find(m => m.id === debtor.id)?.name || 'Unknown';
            let cName = members.find(m => m.id === creditor.id)?.name || 'Unknown';

            html += `
                <div style="background: white; padding: 16px; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display:flex; align-items:center; gap:8px;">
                         <span style="font-weight:500; color: #F44336;">${dName}</span>
                         <span class="material-icons-round" style="color:#ccc; font-size:16px;">arrow_forward</span>
                         <span style="font-weight:500; color: #4CAF50;">${cName}</span>
                    </div>
                    <span style="font-weight:600;">฿${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            `;

            // Update remaining amounts
            debtor.amount += amount;
            creditor.amount -= amount;

            // Move indices if settled
            if (Math.abs(debtor.amount) < 0.01) i++;
            if (creditor.amount < 0.01) j++;
        }

        return html;
    },

    renderTripMembers(memberIds) {
        if (!memberIds || memberIds.length === 0) {
            return `<div style="color: #999; font-size: 0.9rem; font-style: italic;">ยังไม่มีสมาชิก</div>`;
        }

        // Resolve member details
        const members = memberIds.map(id => Store.data.friends.find(f => f.id === id)).filter(Boolean);

        return members.map(m => `
            <div class="member-chip" style="min-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <div class="avatar" style="width: 48px; height: 48px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ${m.photo ? `<img src="${m.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="material-icons-round" style="color:#aaa;">person</span>`}
                </div>
                <span style="font-size: 0.75rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">${m.name}</span>
            </div>
        `).join('');
    },

    renderExpenseList(expenses) {
        if (!expenses || expenses.length === 0) {
            return `
                <div class="empty-state" style="text-align: center; color: #ccc; padding: 20px;">
                    <p>ยังไม่มีรายการค่าใช้จ่าย</p>
                </div>
            `;
        }

        return expenses.map(e => {
            const payer = Store.data.friends.find(f => f.id === e.payerId);
            const payerName = payer ? payer.name : 'Unknown';
            // Note: onclick uses window.ViewManager
            return `
                <div onclick="window.ViewManager.renderCardPreview(window.Store.data.trips.find(t => t.id === '${e.tripId}'), window.Store.data.trips.find(t => t.id === '${e.tripId}').expenses.find(x => x.id === '${e.id}'))" 
                     style="background: white; padding: 12px; border-radius: 12px; margin-bottom: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
                    <div>
                        <div style="font-weight: 500;">${e.title}</div>
                        <div style="font-size: 0.8rem; color: #888;">${payerName} จ่าย</div>
                    </div>
                    <div style="font-weight: 600; color: var(--primary-color);">
                        ฿${e.amount.toLocaleString()}
                    </div>
                </div>
        `;
        }).join('');
    },

    promptAddMemberToTrip(tripId) {
        const friends = Store.data.friends;
        if (friends.length === 0) {
            if (confirm('คุณยังไม่มีรายชื่อเพื่อน โปรดเพิ่มเพื่อน\n\nต้องการไปที่หน้าเพิ่มเพื่อนเลยไหม?')) {
                this.renderAddEditFriend();
            }
            return;
        }

        // Render Modal
        const modalContainer = document.getElementById('modal-container');
        const trip = Store.data.trips.find(t => t.id === tripId);
        const existingMembers = trip.members || [];

        modalContainer.innerHTML = `
            <div class="modal-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <div class="modal-card" style="background: white; width: 100%; max-width: 400px; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                    <h3 style="margin-bottom: 20px; font-size: 1.2rem;">เลือกเพื่อนเข้าทริป</h3>
                    
                    <div id="friend-select-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 24px;">
                        ${friends.map(f => {
            const isAdded = existingMembers.includes(f.id);
            return `
                                <div class="friend-select-item" data-id="${f.id}" style="display: flex; align-items: center; padding: 8px; border-radius: 12px; margin-bottom: 8px; cursor: pointer; background: ${isAdded ? '#f5f5f5' : 'white'}; border: 2px solid ${isAdded ? 'transparent' : '#eee'}; opacity: ${isAdded ? 0.6 : 1}; pointer-events: ${isAdded ? 'none' : 'auto'};">
                                    <div style="position: relative; margin-right: 12px;">
                                        <div class="avatar" style="width: 48px; height: 48px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                            ${f.photo ? `<img src="${f.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="material-icons-round" style="color:#aaa;">person</span>`}
                                        </div>
                                        <div class="check-indicator" style="position: absolute; bottom: 0; right: 0; background: var(--primary-color); color: white; border-radius: 50%; width: 20px; height: 20px; display: none; align-items: center; justify-content: center; border: 2px solid white;">
                                            <span class="material-icons-round" style="font-size: 14px;">check</span>
                                        </div>
                                    </div>
                                    <div style="flex: 1;">
                                        <div style="font-weight: 500;">${f.name}</div>
                                        ${isAdded ? '<span style="font-size: 0.75rem; color: #888;">อยู่ในทริปแล้ว</span>' : ''}
                                    </div>
                                    
                                </div>
                            `;
        }).join('')}
                    </div>

                    <div style="display: flex; gap: 12px;">
                        <button id="btn-cancel-modal" class="btn" style="flex: 1; background: #f5f5f5; color: #666; justify-content: center;">ยกเลิก</button>
                        <button id="btn-confirm-modal" class="btn btn-primary" style="flex: 1; justify-content: center;">เพิ่มเพื่อนที่เลือก</button>
                    </div>
                </div>
            </div>
        `;

        // Interaction Logic
        const selectedIds = new Set();
        const items = modalContainer.querySelectorAll('.friend-select-item');

        items.forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const check = item.querySelector('.check-indicator');

                if (selectedIds.has(id)) {
                    selectedIds.delete(id);
                    item.style.borderColor = '#eee';
                    item.style.backgroundColor = 'white';
                    check.style.display = 'none';
                } else {
                    selectedIds.add(id);
                    item.style.borderColor = 'var(--primary-color)';
                    item.style.backgroundColor = 'var(--primary-light-alpha, #f3e5f5)';
                    check.style.display = 'flex';
                }
            });
        });

        document.getElementById('btn-cancel-modal').addEventListener('click', () => {
            modalContainer.innerHTML = ''; // Close
        });

        document.getElementById('btn-confirm-modal').addEventListener('click', () => {
            if (selectedIds.size > 0) {
                if (!trip.members) trip.members = [];
                selectedIds.forEach(id => trip.members.push(id));
                Store.save();
                this.renderTripDetail(tripId);
            }
            modalContainer.innerHTML = '';
        });
    }
};

/**
 * Extended ViewManager for Friends
 */
Object.assign(ViewManager, {
    renderFriends() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div id="friends-view" class="view active">
                <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>เพื่อนทั้งหมด</h3>
                    <button id="btn-add-friend" class="btn btn-primary" style="padding: 8px 16px; font-size: 0.9rem;">
                        <span class="material-icons-round">person_add</span> เพิ่มเพื่อน
                    </button>
                </div>
                <div id="friend-list" class="friend-list">
                    <!-- Friends will be listed here -->
                </div>
            </div>
        `;

        document.getElementById('btn-add-friend').addEventListener('click', () => {
            this.renderAddEditFriend(); // No ID = Add New
        });

        this.renderFriendList();
    },

    renderFriendList() {
        const listContainer = document.getElementById('friend-list');
        const friends = Store.data.friends;

        if (friends.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state" style="text-align: center; color: #999; padding: 40px;">
                    <span class="material-icons-round" style="font-size: 48px;">groups</span>
                    <p>ยังไม่มีเพื่อน</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = friends.map(friend => `
            <div class="friend-card" style="background: white; padding: 12px; border-radius: 12px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; justify-content: space-between;">
                <div style="display:flex; align-items:center; gap: 12px; flex:1;">
                    <div class="avatar" style="width: 48px; height: 48px; min-width: 48px; background: #eee; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #ddd;">
                        ${friend.photo ? `<img src="${friend.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="material-icons-round" style="color:#aaa;">person</span>`}
                    </div>
                    <div>
                        <h4 style="font-size: 1rem; margin-bottom: 2px;">${friend.name}</h4>
                        <span style="font-size: 0.8rem; color: #888;">${friend.phone || 'ไม่ระบุเบอร์'}</span>
                    </div>
                </div>
                <button class="btn" onclick="window.ViewManager.renderAddEditFriend('${friend.id}')" style="background: #f5f5f5; width:36px; height:36px; padding:0; justify-content:center; border-radius:50%; color:#666;">
                     <span class="material-icons-round" style="font-size: 18px;">edit</span>
                </button>
            </div>
        `).join('');
    },

    renderAddEditFriend(friendId = null) {
        const isEdit = !!friendId;
        const friend = isEdit ? Store.data.friends.find(f => f.id === friendId) : { name: '', phone: '', photo: null };

        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div id="add-friend-view" class="view active">
                <div class="trip-header text-center" style="margin-bottom: 24px;">
                    <button class="btn" id="btn-back-friends" style="position: absolute; left: 16px; top: 16px; padding: 8px; width: 40px; height: 40px; justify-content: center; background: white; box-shadow: var(--shadow-sm);">
                        <span class="material-icons-round">arrow_back</span>
                    </button>
                    <h3>${isEdit ? 'แก้ไขข้อมูล' : 'เพิ่มเพื่อนใหม่'}</h3>
                </div>

                <div style="display:flex; flex-direction:column; align-items:center; margin-bottom: 24px;">
                    <div style="position: relative;">
                         <div id="preview-avatar" style="width: 100px; height: 100px; background: #eee; border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: var(--shadow-md);">
                             ${friend.photo ? `<img src="${friend.photo}" style="width:100%; height:100%; object-fit:cover;">` : `<span class="material-icons-round" style="font-size: 48px; color: #ccc;">person</span>`}
                         </div>
                         <button id="btn-upload-photo" style="position: absolute; bottom: 0; right: 0; background: var(--primary-color); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                            <span class="material-icons-round" style="font-size: 18px;">camera_alt</span>
                         </button>
                         <input type="file" id="inp-friend-photo" accept="image/*" style="display:none;">
                    </div>
                    <p style="font-size: 0.8rem; color: #888; margin-top: 8px;">แตะกล้องเพื่อเปลี่ยนรูป</p>
                </div>

                <form id="form-friend" style="padding: 0 16px;">
                    <div class="input-group" style="margin-bottom: 20px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">ชื่อเลน / ชื่อจริง</label>
                        <input type="text" id="inp-friend-name" value="${friend.name}" placeholder="โปรดกรอกข้อมูล" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 1rem;" required>
                    </div>

                    <div class="input-group" style="margin-bottom: 32px;">
                        <label style="display:block; margin-bottom:8px; font-weight:500;">เบอร์โทรศัพท์ (พร้อมเพย์)</label>
                        <input type="tel" id="inp-friend-phone" value="${friend.phone || ''}" placeholder="08x-xxx-xxxx" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 12px; font-size: 1rem;">
                        <div style="font-size: 0.75rem; color: #888; margin-top: 4px;">ใส่เบอร์เพื่อให้สร้าง QR PromptPay ได้ถูกต้อง</div>
                    </div>

                    <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 16px; font-size: 1rem;">
                        ${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มเพื่อน'}
                    </button>
                    
                    ${isEdit ? `
                        <button type="button" id="btn-delete-friend" style="width: 100%; margin-top: 12px; padding: 12px; background: transparent; color: #F44336; border: 1px solid #fee; border-radius: 12px;">
                            ลบรายชื่อนี้
                        </button>
                    ` : ''}
                </form>
            </div>
         `;

        // Helper: Photo Selection & Resize
        const photoInput = document.getElementById('inp-friend-photo');
        const previewAvatar = document.getElementById('preview-avatar');
        let currentPhotoBase64 = friend.photo;

        document.getElementById('btn-upload-photo').addEventListener('click', () => photoInput.click());

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Resize Logic (Max 250x250)
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const MAX_SIZE = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Output
                    currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.8);
                    previewAvatar.innerHTML = `<img src="${currentPhotoBase64}" style="width:100%; height:100%; object-fit:cover;">`;
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        // Logic: Save
        document.getElementById('form-friend').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('inp-friend-name').value.trim();
            let phone = document.getElementById('inp-friend-phone').value.trim();

            if (!name) return alert('กรุณาใส่ชื่อ');

            // Phone Validation (Thai Mobile)
            if (phone) {
                const cleanPhone = phone.replace(/[^0-9]/g, '');
                if (cleanPhone.length !== 10 || !cleanPhone.startsWith('0')) {
                    alert('เบอร์โทรศัพท์ไม่ถูกต้อง! \nกรุณากรอกเบอร์มือถือ 10 หลัก (เช่น 0812345678)');
                    return;
                }
                phone = cleanPhone;
            }

            if (isEdit) {
                // Update Existing
                const target = Store.data.friends.find(f => f.id === friendId);
                if (target) {
                    target.name = name;
                    target.phone = phone;
                    target.photo = currentPhotoBase64;
                }
            } else {
                // Add New
                Store.data.friends.push({
                    id: 'f' + Date.now(),
                    name,
                    phone,
                    photo: currentPhotoBase64
                });
            }

            Store.save();
            this.renderFriends();
        });

        // Logic: Back
        document.getElementById('btn-back-friends').addEventListener('click', () => {
            this.renderFriends();
        });

        // Logic: Delete
        const btnDelete = document.getElementById('btn-delete-friend');
        if (btnDelete) {
            btnDelete.addEventListener('click', () => {
                if (confirm('ยืนยันลบรายชื่อนี้? (ข้อมูลในทริปจะยังอยู่ แต่ชื่ออาจหายไป)')) {
                    Store.data.friends = Store.data.friends.filter(f => f.id !== friendId);
                    Store.save();
                    this.renderFriends();
                }
            });
        }
    }
});

// Update navigateTo to handle 'friends'
const originalNavigateTo = ViewManager.navigateTo;
ViewManager.navigateTo = function (viewName) {
    if (viewName === 'friends') {
        this.renderFriends();
    } else {
        originalNavigateTo.call(this, viewName);
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Explicitly expose globals for inline handlers
    window.Store = Store;
    window.ViewManager = ViewManager;

    Store.init();

    // Header Title Edit Logic
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        if (Store.data.appName) {
            pageTitle.textContent = Store.data.appName;
        }
        pageTitle.addEventListener('click', () => {
            const currentName = pageTitle.textContent;
            const newName = prompt('ตั้งชื่อแอปของคุณ:', currentName);
            if (newName && newName.trim() !== '') {
                pageTitle.textContent = newName.trim();
                Store.data.appName = newName.trim();
                Store.save();
            }
        });
        pageTitle.style.cursor = 'pointer';
    }

    ViewManager.init();
});
