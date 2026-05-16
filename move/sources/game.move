module agentbet::game {
    use std::signer;
    use std::vector;
    use std::error;
    use initia_std::event;

    const ENOT_ADMIN: u64 = 1;
    const EWINNER_PAYOUT_LEN_MISMATCH: u64 = 2;
    const EPOT_MISMATCH: u64 = 3;

    #[event]
    struct HandSettled has drop, store {
        hand_id: u64,
        table_id: u64,
        winners: vector<address>,
        payouts: vector<u64>,
        losers: vector<address>,
        pot: u64,
    }

    /// Admin (module publisher / gas-station) records the authoritative settlement for a hand.
    /// Emits an on-chain event that can be queried by the frontend + indexer.
    public entry fun record_hand(
        admin: &signer,
        hand_id: u64,
        table_id: u64,
        winners: vector<address>,
        payouts: vector<u64>,
        losers: vector<address>,
        pot: u64,
    ) {
        assert!(signer::address_of(admin) == @agentbet, error::permission_denied(ENOT_ADMIN));

        let n = vector::length(&winners);
        assert!(n == vector::length(&payouts), error::invalid_argument(EWINNER_PAYOUT_LEN_MISMATCH));

        let i = 0;
        let total: u64 = 0;
        while (i < n) {
            total = total + *vector::borrow(&payouts, i);
            i = i + 1;
        };
        assert!(total == pot, error::invalid_argument(EPOT_MISMATCH));

        event::emit(HandSettled { hand_id, table_id, winners, payouts, losers, pot });
    }
}
