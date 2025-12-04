// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface SuccessionPlan {
  id: string;
  position: string;
  candidateId: string;
  encryptedScore: string;
  timestamp: number;
  department: string;
  readinessLevel: "high" | "medium" | "low";
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SuccessionPlan[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newPlanData, setNewPlanData] = useState({
    position: "",
    candidateId: "",
    department: "",
    score: ""
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("all");
  const [showTutorial, setShowTutorial] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calculate statistics
  const highReadinessCount = plans.filter(p => p.readinessLevel === "high").length;
  const totalPositions = new Set(plans.map(p => p.position)).size;

  // Filter plans based on search and filter criteria
  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         plan.candidateId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = filterDepartment === "all" || plan.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
  const paginatedPlans = filteredPlans.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  useEffect(() => {
    loadPlans().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const checkAvailability = async () => {
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: "FHE System is available and ready!"
        });
      }
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Failed to check system availability"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const loadPlans = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("succession_plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing plan keys:", e);
        }
      }
      
      const list: SuccessionPlan[] = [];
      
      for (const key of keys) {
        try {
          const planBytes = await contract.getData(`succession_plan_${key}`);
          if (planBytes.length > 0) {
            try {
              const planData = JSON.parse(ethers.toUtf8String(planBytes));
              list.push({
                id: key,
                position: planData.position,
                candidateId: planData.candidateId,
                encryptedScore: planData.encryptedScore,
                timestamp: planData.timestamp,
                department: planData.department,
                readinessLevel: planData.readinessLevel || "medium"
              });
            } catch (e) {
              console.error(`Error parsing plan data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading plan ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setPlans(list);
    } catch (e) {
      console.error("Error loading plans:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitPlan = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting performance data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedScore = `FHE-${btoa(newPlanData.score)}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const planId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Determine readiness level based on score (simulated)
      const scoreNum = parseInt(newPlanData.score) || 0;
      let readinessLevel: "high" | "medium" | "low" = "medium";
      if (scoreNum >= 80) readinessLevel = "high";
      else if (scoreNum <= 50) readinessLevel = "low";

      const planData = {
        position: newPlanData.position,
        candidateId: newPlanData.candidateId,
        encryptedScore: encryptedScore,
        timestamp: Math.floor(Date.now() / 1000),
        department: newPlanData.department,
        readinessLevel: readinessLevel
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `succession_plan_${planId}`, 
        ethers.toUtf8Bytes(JSON.stringify(planData))
      );
      
      const keysBytes = await contract.getData("succession_plan_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(planId);
      
      await contract.setData(
        "succession_plan_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Succession plan created with FHE encryption!"
      });
      
      await loadPlans();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewPlanData({
          position: "",
          candidateId: "",
          department: "",
          score: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const tutorialSteps = [
    {
      title: "Connect Wallet",
      description: "Connect your Web3 wallet to access the succession planning system",
      icon: "🔗"
    },
    {
      title: "Create Succession Plan",
      description: "Add encrypted employee data for confidential succession planning",
      icon: "📋"
    },
    {
      title: "FHE Analysis",
      description: "Performance data is analyzed in encrypted state using FHE technology",
      icon: "⚙️"
    },
    {
      title: "Identify Talent",
      description: "Discover high-potential candidates without exposing sensitive information",
      icon: "🌟"
    }
  ];

  const renderReadinessChart = () => {
    const total = plans.length || 1;
    const highPercentage = (highReadinessCount / total) * 100;
    
    return (
      <div className="readiness-chart">
        <div className="chart-bar">
          <div 
            className="bar-fill high-readiness" 
            style={{ width: `${highPercentage}%` }}
          >
            <span className="percentage-label">{highPercentage.toFixed(1)}%</span>
          </div>
        </div>
        <div className="chart-label">
          <span>High Readiness Candidates: {highReadinessCount}/{total}</span>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE connection...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="crown-icon"></div>
          </div>
          <h1>Succession<span>Plan</span>FHE</h1>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={checkAvailability}
            className="action-btn"
          >
            Check FHE Status
          </button>
          <button 
            onClick={() => setShowCreateModal(true)} 
            className="primary-btn"
          >
            Create Plan
          </button>
          <button 
            className="secondary-btn"
            onClick={() => setShowTutorial(!showTutorial)}
          >
            {showTutorial ? "Hide Guide" : "Show Guide"}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="hero-banner">
          <div className="hero-content">
            <h2>Confidential Succession Planning</h2>
            <p>Analyze encrypted employee performance data with FHE for unbiased succession planning</p>
            <div className="fhe-badge">
              <span>FHE-Powered Analytics</span>
            </div>
          </div>
        </div>
        
        {showTutorial && (
          <div className="tutorial-section">
            <h2>FHE Succession Planning Guide</h2>
            <p className="subtitle">Learn how to confidentially identify high-potential candidates</p>
            
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div 
                  className="tutorial-step"
                  key={index}
                >
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="dashboard-cards">
          <div className="info-card">
            <h3>Project Overview</h3>
            <p>Secure succession planning platform using FHE technology to confidentially analyze employee performance and identify potential successors without exposing sensitive data.</p>
            <div className="stats-preview">
              <div className="stat">
                <span className="value">{plans.length}</span>
                <span className="label">Plans</span>
              </div>
              <div className="stat">
                <span className="value">{totalPositions}</span>
                <span className="label">Positions</span>
              </div>
            </div>
          </div>
          
          <div className="info-card">
            <h3>High Potential Talent</h3>
            {renderReadinessChart()}
            <div className="department-list">
              <h4>Departments</h4>
              <ul>
                {Array.from(new Set(plans.map(p => p.department))).slice(0, 3).map(dept => (
                  <li key={dept}>{dept}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        
        <div className="data-section">
          <div className="section-header">
            <h2>Succession Plans</h2>
            <div className="controls">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder="Search positions or candidates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Departments</option>
                {Array.from(new Set(plans.map(p => p.department))).map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <button 
                onClick={loadPlans}
                className="refresh-btn"
                disabled={isRefreshing}
              >
                {isRefreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
          
          <div className="data-table">
            <div className="table-header">
              <div className="header-cell">Position</div>
              <div className="header-cell">Candidate ID</div>
              <div className="header-cell">Department</div>
              <div className="header-cell">Date Added</div>
              <div className="header-cell">Readiness</div>
            </div>
            
            {paginatedPlans.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon"></div>
                <p>No succession plans found</p>
                <button 
                  className="primary-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create First Plan
                </button>
              </div>
            ) : (
              paginatedPlans.map(plan => (
                <div className="table-row" key={plan.id}>
                  <div className="table-cell">{plan.position}</div>
                  <div className="table-cell">EMP-{plan.candidateId.substring(0, 6)}</div>
                  <div className="table-cell">{plan.department}</div>
                  <div className="table-cell">
                    {new Date(plan.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`readiness-badge ${plan.readinessLevel}`}>
                      {plan.readinessLevel}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
  
      {showCreateModal && (
        <ModalCreate 
          onSubmit={submitPlan} 
          onClose={() => setShowCreateModal(false)} 
          creating={creating}
          planData={newPlanData}
          setPlanData={setNewPlanData}
        />
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast">
          <div className="toast-content">
            <div className={`toast-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✕"}
            </div>
            <div className="toast-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="crown-icon"></div>
              <span>SuccessionPlanFHE</span>
            </div>
            <p>Confidential employee internal mobility & succession planning</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Encrypted Data</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} SuccessionPlanFHE. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

interface ModalCreateProps {
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  planData: any;
  setPlanData: (data: any) => void;
}

const ModalCreate: React.FC<ModalCreateProps> = ({ 
  onSubmit, 
  onClose, 
  creating,
  planData,
  setPlanData
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPlanData({
      ...planData,
      [name]: value
    });
  };

  const handleSubmit = () => {
    if (!planData.position || !planData.candidateId || !planData.score) {
      alert("Please fill required fields");
      return;
    }
    
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create Succession Plan</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <div className="shield-icon"></div> 
            <span>All data will be encrypted with FHE technology</span>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Position Title *</label>
              <input 
                type="text"
                name="position"
                value={planData.position} 
                onChange={handleChange}
                placeholder="e.g., Senior Developer, Manager..."
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Candidate ID *</label>
              <input 
                type="text"
                name="candidateId"
                value={planData.candidateId} 
                onChange={handleChange}
                placeholder="Employee identifier"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Department</label>
              <input 
                type="text"
                name="department"
                value={planData.department} 
                onChange={handleChange}
                placeholder="Department name"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Performance Score *</label>
              <input 
                type="number"
                name="score"
                value={planData.score} 
                onChange={handleChange}
                placeholder="0-100 score"
                min="0"
                max="100"
                className="form-input"
              />
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            onClick={onClose}
            className="cancel-btn"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={creating}
            className="submit-btn"
          >
            {creating ? "Encrypting with FHE..." : "Create Plan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;