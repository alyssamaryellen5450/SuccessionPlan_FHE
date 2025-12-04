// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract EmployeeSuccession_FHE is SepoliaConfig {
    struct EncryptedEmployee {
        uint256 employeeId;
        euint32 encryptedPerformance;
        euint32 encryptedPotential;
        euint32 encryptedSkills;
        euint32 encryptedTenure;
        uint256 timestamp;
        address hrManager;
    }

    struct DecryptedEmployee {
        uint32 performance;
        uint32 potential;
        uint32 skills;
        uint32 tenure;
        bool isRevealed;
    }

    struct SuccessionPlan {
        euint32 readinessScore;
        euint32 compatibilityScore;
        euint32 developmentNeeds;
    }

    uint256 public employeeCount;
    mapping(uint256 => EncryptedEmployee) public encryptedEmployees;
    mapping(uint256 => DecryptedEmployee) public decryptedEmployees;
    mapping(uint256 => SuccessionPlan) public successionPlans;

    mapping(uint256 => uint256) private requestToEmployeeId;
    
    event EmployeeDataSubmitted(uint256 indexed employeeId, address indexed hrManager, uint256 timestamp);
    event SuccessionPlanCreated(uint256 indexed employeeId);
    event EmployeeDataDecrypted(uint256 indexed employeeId);

    modifier onlyHRManager(uint256 employeeId) {
        require(msg.sender == encryptedEmployees[employeeId].hrManager, "Not authorized HR manager");
        _;
    }

    function registerEmployee(address hrManager) public returns (uint256) {
        employeeCount += 1;
        return employeeCount;
    }

    function submitEncryptedEmployeeData(
        euint32 encryptedPerformance,
        euint32 encryptedPotential,
        euint32 encryptedSkills,
        euint32 encryptedTenure,
        address hrManager
    ) public {
        uint256 employeeId = registerEmployee(hrManager);
        
        encryptedEmployees[employeeId] = EncryptedEmployee({
            employeeId: employeeId,
            encryptedPerformance: encryptedPerformance,
            encryptedPotential: encryptedPotential,
            encryptedSkills: encryptedSkills,
            encryptedTenure: encryptedTenure,
            timestamp: block.timestamp,
            hrManager: hrManager
        });

        decryptedEmployees[employeeId] = DecryptedEmployee({
            performance: 0,
            potential: 0,
            skills: 0,
            tenure: 0,
            isRevealed: false
        });

        createSuccessionPlan(employeeId);
        emit EmployeeDataSubmitted(employeeId, hrManager, block.timestamp);
    }

    function createSuccessionPlan(uint256 employeeId) private {
        EncryptedEmployee storage employee = encryptedEmployees[employeeId];
        
        successionPlans[employeeId] = SuccessionPlan({
            readinessScore: FHE.add(
                FHE.mul(employee.encryptedPerformance, FHE.asEuint32(3)),
                FHE.mul(employee.encryptedPotential, FHE.asEuint32(2))
            ),
            compatibilityScore: FHE.div(
                FHE.add(employee.encryptedSkills, employee.encryptedTenure),
                FHE.asEuint32(2)
            ),
            developmentNeeds: FHE.sub(
                FHE.asEuint32(100),
                FHE.div(
                    FHE.add(employee.encryptedSkills, employee.encryptedPotential),
                    FHE.asEuint32(2)
                )
            )
        });

        emit SuccessionPlanCreated(employeeId);
    }

    function requestEmployeeDataDecryption(uint256 employeeId) public onlyHRManager(employeeId) {
        require(!decryptedEmployees[employeeId].isRevealed, "Already decrypted");

        EncryptedEmployee storage employee = encryptedEmployees[employeeId];
        
        bytes32[] memory ciphertexts = new bytes32[](4);
        ciphertexts[0] = FHE.toBytes32(employee.encryptedPerformance);
        ciphertexts[1] = FHE.toBytes32(employee.encryptedPotential);
        ciphertexts[2] = FHE.toBytes32(employee.encryptedSkills);
        ciphertexts[3] = FHE.toBytes32(employee.encryptedTenure);
        
        uint256 reqId = FHE.requestDecryption(ciphertexts, this.decryptEmployeeData.selector);
        requestToEmployeeId[reqId] = employeeId;
    }

    function decryptEmployeeData(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        uint256 employeeId = requestToEmployeeId[requestId];
        require(employeeId != 0, "Invalid request");

        DecryptedEmployee storage dEmployee = decryptedEmployees[employeeId];
        require(!dEmployee.isRevealed, "Already decrypted");

        FHE.checkSignatures(requestId, cleartexts, proof);

        (uint32 performance, uint32 potential, uint32 skills, uint32 tenure) = 
            abi.decode(cleartexts, (uint32, uint32, uint32, uint32));
        
        dEmployee.performance = performance;
        dEmployee.potential = potential;
        dEmployee.skills = skills;
        dEmployee.tenure = tenure;
        dEmployee.isRevealed = true;

        emit EmployeeDataDecrypted(employeeId);
    }

    function requestSuccessionPlanDecryption(uint256 employeeId) public onlyHRManager(employeeId) {
        SuccessionPlan storage plan = successionPlans[employeeId];
        
        bytes32[] memory ciphertexts = new bytes32[](3);
        ciphertexts[0] = FHE.toBytes32(plan.readinessScore);
        ciphertexts[1] = FHE.toBytes32(plan.compatibilityScore);
        ciphertexts[2] = FHE.toBytes32(plan.developmentNeeds);
        
        FHE.requestDecryption(ciphertexts, this.decryptSuccessionPlan.selector);
    }

    function decryptSuccessionPlan(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory proof
    ) public {
        FHE.checkSignatures(requestId, cleartexts, proof);
        (uint32 readiness, uint32 compatibility, uint32 development) = 
            abi.decode(cleartexts, (uint32, uint32, uint32));
        // Process decrypted succession plan as needed
    }

    function getDecryptedEmployeeData(uint256 employeeId) public view onlyHRManager(employeeId) returns (
        uint32 performance,
        uint32 potential,
        uint32 skills,
        uint32 tenure,
        bool isRevealed
    ) {
        DecryptedEmployee storage e = decryptedEmployees[employeeId];
        return (e.performance, e.potential, e.skills, e.tenure, e.isRevealed);
    }
}