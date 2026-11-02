package vc

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"strings"
)

// did:key for Ed25519 = "did:key:" + base58btc( 0xed01 || pubkey ).
// Base58 is implemented here (alphabet Bitcoin) to keep dependencies at zero.

const b58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

var ed25519MulticodecPrefix = []byte{0xed, 0x01}

// multibaseEncode returns the did:key suffix for an Ed25519 public key.
func multibaseEncode(pub ed25519.PublicKey) string {
	data := append(append([]byte{}, ed25519MulticodecPrefix...), pub...)
	return "z" + base58Encode(data)
}

// multibaseDecodeDIDKey extracts the Ed25519 public key from a did:key string.
func multibaseDecodeDIDKey(did string) (ed25519.PublicKey, error) {
	if !strings.HasPrefix(did, "did:key:z") {
		return nil, errors.New("not a did:key with multibase-z encoding")
	}
	data, err := base58Decode(did[len("did:key:z"):])
	if err != nil {
		return nil, err
	}
	if len(data) != 2+ed25519.PublicKeySize || data[0] != 0xed || data[1] != 0x01 {
		return nil, errors.New("not an Ed25519 multicodec key")
	}
	return ed25519.PublicKey(data[2:]), nil
}

func base58Encode(data []byte) string {
	// Count leading zero bytes → '1' each
	var zeros int
	for zeros < len(data) && data[zeros] == 0 {
		zeros++
	}
	// Convert big-endian integer to base58
	size := len(data)*138/100 + 1
	buf := make([]byte, size)
	for _, b := range data {
		carry := int(b)
		for i := size - 1; i >= 0; i-- {
			carry += int(buf[i]) << 8
			buf[i] = byte(carry % 58)
			carry /= 58
		}
	}
	i := 0
	for i < size && buf[i] == 0 {
		i++
	}
	var out strings.Builder
	for j := 0; j < zeros; j++ {
		out.WriteByte('1')
	}
	for ; i < size; i++ {
		out.WriteByte(b58Alphabet[buf[i]])
	}
	return out.String()
}

func base58Decode(s string) ([]byte, error) {
	var zeros int
	for zeros < len(s) && s[zeros] == '1' {
		zeros++
	}
	buf := []byte{}
	for i := zeros; i < len(s); i++ {
		idx := strings.IndexByte(b58Alphabet, s[i])
		if idx < 0 {
			return nil, fmt.Errorf("invalid base58 character %q", s[i])
		}
		carry := idx
		for j := len(buf) - 1; j >= 0; j-- {
			carry += int(buf[j]) * 58
			buf[j] = byte(carry & 0xff)
			carry >>= 8
		}
		for carry > 0 {
			buf = append([]byte{byte(carry & 0xff)}, buf...)
			carry >>= 8
		}
	}
	return append(make([]byte, zeros), buf...), nil
}
