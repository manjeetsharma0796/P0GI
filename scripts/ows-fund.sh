#!/bin/bash
# Fund OWS agent wallets from Llama's wallet
# Run: echo 'bash /mnt/c/workspace/claude-adding-skill/poker-night-ai/scripts/ows-fund.sh' | wsl

OWS="/home/manjeet0796/.ows/bin/ows"
PASS="agent-poker-hackathon"

echo "=== Exporting Llama's mnemonic ==="
# Use expect-like approach with script command
MNEMONIC=$(echo "$PASS" | $OWS wallet export --wallet poker-llama 2>/dev/null || true)

if [ -z "$MNEMONIC" ]; then
  echo "OWS export needs interactive mode."
  echo ""
  echo "Please run this manually in WSL:"
  echo ""
  echo "  $OWS wallet export --wallet poker-llama"
  echo ""
  echo "Enter the passphrase when prompted, then copy the mnemonic."
  echo ""
  echo "Then use MetaMask or another wallet to import the mnemonic"
  echo "and send 0.008 ETH + 10 USDC to each of these addresses:"
  echo ""
  echo "  Mistral:  0x2F445DB3961E33d6500537Cd796b4812CBf7Db6b"
  echo "  DeepSeek: 0x765A6824A400f714a59d99FbF4A04C252A5E328e"
  echo "  Qwen:     0xcA10A9910b62979eDA09A92CB78720fF67ffdb00"
  echo "  Pot:      0xaD2390a2C25cAF161A61d7cCD0Cd197F1130e8E8"
  echo ""
  echo "USDC contract (Sepolia): 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
fi
