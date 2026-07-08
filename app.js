import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0tYLUMbM16hBPlwFHrRIrUZsRsGjL_qU",
  authDomain: "technical-clarification.firebaseapp.com",
  projectId: "technical-clarification",
  storageBucket: "technical-clarification.firebasestorage.app",
  messagingSenderId: "75688244720",
  appId: "1:75688244720:web:781e2944c7aad87156d935",
  measurementId: "G-PG1CWBLV78"
};

// Initialize Firebase (wrapped in try-catch to prevent crash if config is missing)
let app, auth, db;
let isFirebaseConfigured = false;
try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        isFirebaseConfigured = true;
    }
} catch (e) {
    console.error("Firebase Initialization Error:", e);
}

// App State
let currentUser = null;
let currentDocId = null; // null if creating a new document
let currentDocAuthorId = null;

// DOM Elements
const btnLogin = document.getElementById('btnLogin');
const btnLogout = document.getElementById('btnLogout');
const btnSaveDB = document.getElementById('btnSaveDB');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const btnNewDoc = document.getElementById('btnNewDoc');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('main-content');
const topbar = document.getElementById('topbar');
const userInfo = document.getElementById('userInfo');
const userName = document.getElementById('userName');
const roleBadge = document.getElementById('roleBadge');
const docList = document.getElementById('docList');
const searchInput = document.getElementById('searchInput');
const authWarning = document.getElementById('authWarning');
const docStatusBadge = document.getElementById('docStatusBadge');
const editBlocks = document.querySelectorAll('.edit-block');

// Sidebar Toggle Logic
btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    if (sidebar.classList.contains('closed')) {
        mainContent.style.marginLeft = '0';
        topbar.style.left = '0';
    } else {
        mainContent.style.marginLeft = '320px';
        topbar.style.left = '320px';
    }
});

// Authentication Logic
if (isFirebaseConfigured) {
    const provider = new GoogleAuthProvider();

    btnLogin.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed:", error);
            alert("로그인 중 오류가 발생했습니다.\n\n[상세 에러 내용]\n" + error.code + "\n" + error.message);
        }
    });

    btnLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            // [테스트를 위해 임시 해제됨] 이메일 도메인 검사 (@emko.com 만 허용)
            // if (!user.email.endsWith('@emko.com')) {
            //     alert("EMKO 회사 이메일(@emko.com) 계정으로만 접근이 가능합니다.");
            //     signOut(auth); // 강제 로그아웃
            //     return;
            // }
            currentUser = user;
            updateUIBasedOnAuth();
            fetchDocuments();
        } else {
            currentUser = null;
            updateUIBasedOnAuth();
            docList.innerHTML = '<div class="text-center text-sm text-slate-500 mt-10">로그인하여<br>문서를 불러오세요.</div>';
        }
    });
} else {
    // Show warning if Firebase not configured
    console.warn("Firebase is not configured. Running in UI-only local mode.");
    docList.innerHTML = '<div class="text-center text-sm text-red-500 mt-10 font-bold">Firebase 설정이 누락되었습니다.<br>app.js 코드를 수정하세요.</div>';
}

function updateUIBasedOnAuth() {
    if (currentUser) {
        btnLogin.classList.add('hidden');
        btnLogout.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        userName.textContent = currentUser.displayName;
        btnSaveDB.classList.remove('hidden');
        
        // Basic Role simulation (In a real app, use Firestore Custom Claims)
        // Here we just mock admin if email is specific, otherwise 'User'
        const isAdmin = currentUser.email.includes('admin'); 
        roleBadge.textContent = isAdmin ? 'Admin' : 'User';
        roleBadge.className = isAdmin ? 'bg-red-600 px-2 py-0.5 rounded text-xs text-white' : 'bg-blue-600 px-2 py-0.5 rounded text-xs text-white';
        
    } else {
        btnLogin.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        userInfo.classList.add('hidden');
        btnSaveDB.classList.add('hidden');
    }
    checkEditPermissions();
}

function checkEditPermissions() {
    let hasPermission = false;
    if (currentUser) {
        const isAdmin = currentUser.email.includes('admin');
        if (isAdmin || currentDocId === null || currentDocAuthorId === currentUser.uid) {
            hasPermission = true; // Admin, New Doc, or Owner
        }
    }

    // Toggle editable attributes
    editBlocks.forEach(block => {
        if (hasPermission) {
            block.setAttribute('contenteditable', 'true');
            block.classList.add('editable');
        } else {
            block.setAttribute('contenteditable', 'false');
            block.classList.remove('editable');
        }
    });

    if (!hasPermission) {
        authWarning.classList.remove('hidden');
        btnSaveDB.classList.add('hidden');
    } else {
        authWarning.classList.add('hidden');
        if (currentUser) btnSaveDB.classList.remove('hidden');
    }
}

// Database Save Logic
btnSaveDB.addEventListener('click', async () => {
    if (!isFirebaseConfigured || !currentUser) return;
    
    // Gather data from DOM
    const docData = {
        title: document.getElementById('eb-subtitle').innerText || '제목 없음',
        project: document.getElementById('eb-project').innerText,
        content: {},
        updatedAt: new Date(),
    };
    
    editBlocks.forEach(block => {
        docData.content[block.id] = block.innerHTML;
    });

    try {
        btnSaveDB.innerText = '저장 중...';
        if (currentDocId) {
            // Update existing
            const docRef = doc(db, "tcs", currentDocId);
            await updateDoc(docRef, docData);
        } else {
            // Create new
            docData.createdAt = new Date();
            docData.authorId = currentUser.uid;
            docData.authorName = currentUser.displayName;
            
            const docRef = await addDoc(collection(db, "tcs"), docData);
            currentDocId = docRef.id;
            currentDocAuthorId = currentUser.uid;
        }
        
        docStatusBadge.classList.add('hidden');
        alert("성공적으로 저장되었습니다.");
        fetchDocuments(); // refresh list
    } catch (e) {
        console.error("Error saving document: ", e);
        alert("저장에 실패했습니다.");
    } finally {
        btnSaveDB.innerHTML = `<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> DB에 저장`;
    }
});

// Database Load Logic
let allDocs = [];
async function fetchDocuments() {
    if (!isFirebaseConfigured) return;
    
    try {
        const q = query(collection(db, "tcs"), orderBy("updatedAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        allDocs = [];
        querySnapshot.forEach((doc) => {
            allDocs.push({ id: doc.id, ...doc.data() });
        });
        
        renderDocumentList(allDocs);
    } catch (e) {
        console.error("Error loading documents: ", e);
    }
}

function renderDocumentList(docs) {
    docList.innerHTML = '';
    if (docs.length === 0) {
        docList.innerHTML = '<div class="text-center text-sm text-slate-500 mt-5">저장된 문서가 없습니다.</div>';
        return;
    }

    docs.forEach(d => {
        const item = document.createElement('div');
        item.className = `p-3 rounded-md border border-slate-200 cursor-pointer transition-colors ${currentDocId === d.id ? 'bg-blue-50 border-blue-300' : 'bg-white hover:bg-slate-50'}`;
        
        const dateStr = d.updatedAt ? d.updatedAt.toDate().toLocaleDateString() : '';
        
        item.innerHTML = `
            <div class="font-bold text-sm text-slate-800 truncate" title="${d.title}">${d.title}</div>
            <div class="text-xs text-slate-500 mt-1 flex justify-between">
                <span class="truncate max-w-[120px]">${d.project}</span>
                <span>${d.authorName}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-1">${dateStr}</div>
        `;
        
        item.addEventListener('click', () => loadDocumentIntoEditor(d));
        docList.appendChild(item);
    });
}

function loadDocumentIntoEditor(docData) {
    currentDocId = docData.id;
    currentDocAuthorId = docData.authorId;
    
    if (docData.content) {
        editBlocks.forEach(block => {
            if (docData.content[block.id] !== undefined) {
                block.innerHTML = docData.content[block.id];
            }
        });
    }
    
    docStatusBadge.classList.add('hidden');
    checkEditPermissions();
    renderDocumentList(allDocs); // to update active styling
}

// Search Functionality
searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = allDocs.filter(d => 
        (d.title && d.title.toLowerCase().includes(keyword)) ||
        (d.project && d.project.toLowerCase().includes(keyword))
    );
    renderDocumentList(filtered);
});

// New Document Button
btnNewDoc.addEventListener('click', () => {
    if (confirm("새 문서를 작성하시겠습니까? 저장하지 않은 내용은 사라집니다.")) {
        // Simple reload to reset state (or manually clear form)
        location.reload();
    }
});

// Listen for unsaved changes
editBlocks.forEach(block => {
    block.addEventListener('input', () => {
        docStatusBadge.classList.remove('hidden');
    });
});

// Local Auto-save for offline/unsaved work (similar to previous)
const LOCAL_KEY = 'tc-fullstack-draft';
window.addEventListener('beforeunload', () => {
    if (!docStatusBadge.classList.contains('hidden')) {
        const localData = {};
        editBlocks.forEach(block => localData[block.id] = block.innerHTML);
        localStorage.setItem(LOCAL_KEY, JSON.stringify(localData));
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (currentDocId === null) {
        const saved = localStorage.getItem(LOCAL_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                editBlocks.forEach(block => {
                    if (data[block.id] !== undefined) block.innerHTML = data[block.id];
                });
            } catch (e) {}
        }
    }
});
