#!/bin/bash
# IL Shield Soak Test Keeper
# Runs continuously on the server, executing random market operations
# against the live Sepolia deployment to validate durability.
#
# Usage: nohup ./scripts/soak_keeper.sh &
# Stop:  kill $(cat soak_keeper.pid)

set -euo pipefail

source .env
echo $$ > soak_keeper.pid

CORE_ADDRESS=${CORE_ADDRESS:-"0x73317bd4f7c196440DA38E1225012Eb579eBFBeF"}
USDC_ADDRESS=${TEST_USDC:-"0xc6ffEA5afAf2fd72CF00140dd3DDa8841682128E"}
RPC=${SEPOLIA_RPC_URL}
KEY=${DEPLOYER_PRIVATE_KEY}
INTERVAL=${SOAK_INTERVAL:-60}
ITERATION=0

mkdir -p test_results/soak

log() {
    local ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    echo "$ts | $1" | tee -a test_results/soak/keeper_log.txt
}

log "Soak keeper started | core=$CORE_ADDRESS | interval=${INTERVAL}s"

while true; do
    ITERATION=$((ITERATION + 1))
    TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Every iteration: check Chainlink price
    PRICE=$(cast call 0x694AA1769357215DE4FAC081bf1f309aDC325306 \
        "latestRoundData()(uint80,int256,uint256,uint256,uint80)" \
        --rpc-url "$RPC" 2>/dev/null | head -2 | tail -1 || echo "0")
    log "iter=$ITERATION | chainlink_price=$PRICE"

    # Every 10 iterations: process streaming for position 0
    if (( ITERATION % 10 == 0 )); then
        TX=$(cast send "$CORE_ADDRESS" \
            "processStreaming(uint256[])" "[0]" \
            --rpc-url "$RPC" \
            --private-key "$KEY" \
            --json 2>/dev/null | jq -r '.transactionHash // "failed"' || echo "failed")
        log "streaming | tx=$TX"
    fi

    # Every 100 iterations: register a new position
    if (( ITERATION % 100 == 0 )); then
        # Approve USDC
        cast send "$USDC_ADDRESS" \
            "approve(address,uint256)" "$CORE_ADDRESS" "100000000" \
            --rpc-url "$RPC" \
            --private-key "$KEY" \
            --json 2>/dev/null > /dev/null || true

        TX=$(cast send "$CORE_ADDRESS" \
            "register(uint256,uint8,uint48,uint256,address)" \
            "1" "2" "216000" "100000000" "0x0000000000000000000000000000000000000000" \
            --rpc-url "$RPC" \
            --private-key "$KEY" \
            --json 2>/dev/null | jq -r '.transactionHash // "failed"' || echo "failed")
        log "register | tx=$TX"
    fi

    # Every 60 iterations (~1 hour at 60s interval): check vault health
    if (( ITERATION % 60 == 0 )); then
        SENIOR=$(cast call 0x8BDE08C4BD88dbE16561F2990D7DE75B76Fc3752 \
            "totalAssets()(uint256)" --rpc-url "$RPC" 2>/dev/null || echo "0")
        JUNIOR=$(cast call 0x0d6d128c1CF0a8E8032B7d3910A22197fDDC3bEA \
            "totalAssets()(uint256)" --rpc-url "$RPC" 2>/dev/null || echo "0")
        log "health | senior=$SENIOR | junior=$JUNIOR"

        # Commit and push logs
        git add test_results/soak/ 2>/dev/null || true
        git commit -m "soak: checkpoint at $TS (iter=$ITERATION)" 2>/dev/null || true
        git push origin HEAD 2>/dev/null || true
    fi

    sleep "$INTERVAL"
done
