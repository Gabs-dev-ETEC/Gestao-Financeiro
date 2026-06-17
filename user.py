
from app import app, db, Usuario
from werkzeug.security import generate_password_hash

def criar_usuario(username, senha, tipo):
    with app.app_context():

        existe = Usuario.query.filter_by(username=username).first()
        if existe:
            print(f"Usuário '{username}' já existe.")
            return

        novo = Usuario(
            username=username,
            password_hash=generate_password_hash(senha),
            tipo=tipo
        )

        db.session.add(novo)
        db.session.commit()

        print(f"Usuário '{username}' criado com sucesso!")

if __name__ == "__main__":
    criar_usuario("07663696174", "07663696174", "admin")
    criar_usuario("07626243102", "07626243102", "admin")
    criar_usuario("05405469173", "05405469173", "admin")
    criar_usuario("03774249199", "03774249199", "admin")
    criar_usuario("07626249143", "07626249143", "admin")

    criar_usuario("86496824134", "86496824134", "usuario") 
