import psycopg2
import configus2
def getData():
    conn = psycopg2.connect(**configus2.db_config)
    cur = conn.cursor()
    cur.execute('SELECT * FROM music')
    musicData = cur.fetchall()
    print(musicData)