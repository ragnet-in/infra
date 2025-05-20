// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DevReputation {
    struct Query {
        address asker;
        string content;
        uint256 timestamp;
    }

    struct UserScore {
        address user;
        uint256 score;
    }

    Query[] public queries;
    address[] public users;

    mapping(address => uint256) private reputation;
    mapping(address => uint256) private lastQueryTimestamp;
    mapping(address => uint256) private queryStreak;
    mapping(address => bool) private isUser;

    uint256 public creationTime;

    event QueryPosted(
        address indexed asker,
        string query,
        uint256 indexed queryId
    );

    constructor() {
        creationTime = block.timestamp;
    }

    function postQuery(string calldata query) external {
        require(bytes(query).length > 0, "Query cannot be empty");

        // Store user if new
        if (!isUser[msg.sender]) {
            isUser[msg.sender] = true;
            users.push(msg.sender);
        }

        // Store the query
        queries.push(
            Query({
                asker: msg.sender,
                content: query,
                timestamp: block.timestamp
            })
        );

        uint256 baseScore = 1;
        uint256 currentRep = reputation[msg.sender];
        uint256 score = baseScore;

        // Tiered growth: log-style decay
        uint256 tierBoost = 100 / (1 + _sqrt(currentRep + 1));
        score += tierBoost;

        // Early adopter bonus
        if (block.timestamp - creationTime < 30 minutes) {
            score += 10;
        }

        // Cooldown logic
        uint256 timeSinceLast = block.timestamp -
            lastQueryTimestamp[msg.sender];
        if (timeSinceLast < 10 minutes) {
            score -= 5;
        } else if (timeSinceLast < 1 days) {
            score += 5;
        }

        // Query length weighting
        uint256 lengthFactor = bytes(query).length;
        if (lengthFactor >= 100) {
            score += 3;
        } else if (lengthFactor < 20) {
            score -= 2;
        }

        // Streak logic
        if (timeSinceLast > 22 hours && timeSinceLast < 26 hours) {
            queryStreak[msg.sender] += 1;
            score += queryStreak[msg.sender];
        } else if (timeSinceLast > 2 days) {
            queryStreak[msg.sender] = 1;
        }

        // Similarity penalty
        uint256 similarityPenalty = _checkSimilarity(query);
        if (similarityPenalty > 0) {
            score -= similarityPenalty;
        }

        // Anti-whale decay
        if (currentRep > 200) {
            score = (score * 60) / 100;
        } else if (currentRep > 100) {
            score = (score * 75) / 100;
        }

        if (score > 0) {
            reputation[msg.sender] += score;
        }

        lastQueryTimestamp[msg.sender] = block.timestamp;

        emit QueryPosted(msg.sender, query, queries.length - 1);
    }

    function getUserScore(address user) public view returns (uint256) {
        return reputation[user];
    }

    function getTotalQueries() public view returns (uint256) {
        return queries.length;
    }

    function getQuery(
        uint256 queryId
    ) public view returns (address, string memory, uint256) {
        require(queryId < queries.length, "Invalid query ID");
        Query memory q = queries[queryId];
        return (q.asker, q.content, q.timestamp);
    }

    function getAllUserScores() public view returns (UserScore[] memory) {
        uint256 len = users.length;
        UserScore[] memory result = new UserScore[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = UserScore({
                user: users[i],
                score: reputation[users[i]]
            });
        }
        return result;
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _checkSimilarity(
        string calldata newQuery
    ) internal view returns (uint256) {
        uint256 len = queries.length;
        if (len == 0) return 0;

        bytes32[] memory newTokens = _getHashedTokens(newQuery);
        uint256 maxOverlap = 0;

        for (uint256 i = len > 5 ? len - 5 : 0; i < len; i++) {
            if (queries[i].asker != msg.sender) continue;

            bytes32[] memory oldTokens = _getHashedTokens(queries[i].content);
            uint256 overlap = _countOverlap(newTokens, oldTokens);

            if (overlap > maxOverlap) {
                maxOverlap = overlap;
            }
        }

        if (maxOverlap >= newTokens.length / 2) {
            return 5 + maxOverlap;
        }

        return 0;
    }

    function _getHashedTokens(
        string memory input
    ) internal pure returns (bytes32[] memory) {
        bytes memory b = bytes(input);
        uint256 tokenCount = 0;
        bool inToken = false;

        // Count tokens
        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] != 0x20 && !inToken) {
                inToken = true;
                tokenCount++;
            } else if (b[i] == 0x20) {
                inToken = false;
            }
        }

        bytes32[] memory tokens = new bytes32[](tokenCount);
        bytes memory token = "";
        uint256 idx = 0;
        inToken = false;

        for (uint256 i = 0; i < b.length; i++) {
            if (b[i] != 0x20) {
                token = abi.encodePacked(token, b[i]);
                inToken = true;
            } else if (inToken) {
                tokens[idx++] = keccak256(token);
                token = "";
                inToken = false;
            }
        }

        if (inToken) {
            tokens[idx] = keccak256(token);
        }

        return tokens;
    }

    function _countOverlap(
        bytes32[] memory a,
        bytes32[] memory b
    ) internal pure returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < a.length; i++) {
            for (uint256 j = 0; j < b.length; j++) {
                if (a[i] == b[j]) {
                    count++;
                    break;
                }
            }
        }
        return count;
    }
}
