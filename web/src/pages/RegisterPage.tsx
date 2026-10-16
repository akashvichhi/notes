import { memo, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'


import { normalizeError } from '@/api/client'
import { useRegister } from '@/hooks/queries/useAuth'
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '@/lib/validation'

export const RegisterPage = memo(function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()

  const form = useForm({
    initialValues: { name: '', email: '', password: '', password_confirmation: '' },
    validate:      {
      name:                  (v) => (v.trim().length > 0 ? null : 'Enter your name'),
      email:                 validateEmail,
      password:              validatePassword,
      password_confirmation: validatePasswordConfirmation,
    },
  })

  const error = useMemo(() => (register.error ? normalizeError(register.error) : null), [register.error])

  const handleSubmit = useCallback(
    (values: { name: string; email: string; password: string; password_confirmation: string }) => {
      register.mutate(values, { onSuccess: () => navigate('/') })
    },
    [navigate, register]
  )

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder maw="100%" p="xl" w={400}>
        <Title mb="lg" order={2}>Create an account</Title>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput autoComplete="name" label="Name" {...form.getInputProps('name')} />
            <TextInput autoComplete="email" label="Email" {...form.getInputProps('email')} />
            <PasswordInput
              autoComplete="new-password"
              label="Password"
              {...form.getInputProps('password')}
            />
            <PasswordInput
              autoComplete="new-password"
              label="Confirm password"
              {...form.getInputProps('password_confirmation')}
            />

            <Button fullWidth loading={register.isPending} type="submit">
              Register
            </Button>

            <Button component={Link} to="/login" variant="white">
              Already have an account? Sign in
            </Button>

            <Button component={Link} to="/" variant="subtle">
              Continue without signing in (local notes)
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
})
