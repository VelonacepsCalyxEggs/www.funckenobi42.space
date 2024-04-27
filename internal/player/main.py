import sort 
import play
import os
import time


while True:
    time.sleep(0.5)
    userInput = input("Enter a command: ")
    if userInput == "exit":
        print("goodbye!")
        break
    elif userInput == "sort":
        sort.collectInitialData()
    elif userInput == "restart":
        1
    elif userInput == "start":
        play.Player()
    else:
        print("unknown command...")
