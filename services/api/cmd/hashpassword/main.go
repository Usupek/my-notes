package main

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	fmt.Fprint(os.Stderr, "Password admin: ")
	password, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && len(password) == 0 {
		fmt.Fprintln(os.Stderr, "gagal membaca password")
		os.Exit(1)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(password)), bcrypt.DefaultCost)
	if err != nil {
		fmt.Fprintln(os.Stderr, "gagal membuat hash")
		os.Exit(1)
	}
	fmt.Printf("ADMIN_PASSWORD_HASH='%s'\n", hash)
}
