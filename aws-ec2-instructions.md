# EC2 Setup Instructions

## 1. Connect to EC2 Instance via EC2 Instance Connect

## 2. Install Node Version Manager (nvm) and Node.js

- **Switch to superuser and install nvm:**

  ```
  sudo su -
  ```

  ```
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  ```

- **Activate nvm:**

  ```
  . ~/.nvm/nvm.sh
  ```

- **Install the latest version of Node.js using nvm:**

  ```
  nvm install node
  ```

- **Verify that Node.js and npm are installed:**

  ```
  node -v
  ```

  ```
  npm -v
  ```

## 3. Install Git

- **Update the system and install Git:**

  ```
  sudo yum update -y
  ```

  ```
  sudo yum install git -y
  ```

- **Check Git version:**

  ```
  git --version
  ```

- **Clone your code repository from GitHub:**

  ```
  git clone [your-github-link]
  ```

- **Navigate to the directory and install packages:**

  ```
  cd homematch
  ```

  ```
  cd server
  ```

  ```
  npm i
  ```

