async function getLastButtonPress(userId) {
    const { rows } = await pool_radio.query('SELECT * FROM get_last_button_press($1)', [userId]);
    return rows[0];
  }
  
  // Function to reset the button press count
  async function resetButtonPressCount(userId, currentTime) {
    await pool_radio.query('SELECT reset_button_press_count($1, $2)', [userId, currentTime]);
  }
  
  // Function to increment the button press count
  async function incrementButtonPressCount(userId) {
    await pool_radio.query('SELECT increment_button_press_count($1)', [userId]);
  }