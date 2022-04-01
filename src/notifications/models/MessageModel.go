package models

type WelcomeMessageModel struct {
	Email     string `json:"email"`
	Title     string `json:"title"`
	FirstName string `json:"firstName"`
	LastName  string `json:"lastName"`
	Platform  string `json:"platform"`
}
